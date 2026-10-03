package com.nickghignatti.tracker.data.remote

import com.nickghignatti.tracker.data.di.NetworkModule
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.repository.ProductLookup
import com.nickghignatti.tracker.domain.repository.ProductSearch
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class OpenFoodFactsRepositoryTest {

    private val server = MockWebServer()
    private lateinit var repository: OpenFoodFactsRepository

    @Before
    fun setUp() {
        server.start()
        val url = server.url("/")
        repository = OpenFoodFactsRepository(
            NetworkModule.provideOkHttpClient(),
            NetworkModule.provideJson(),
            OpenFoodFactsEndpoints(products = url, search = url),
        )
    }

    @After
    fun tearDown() = server.close()

    private fun respond(code: Int = 200, body: String) =
        server.enqueue(MockResponse.Builder().code(code).body(body).build())

    @Test
    fun `a known barcode becomes a product, preferring the Italian name`() = runTest {
        respond(
            body = """
                {"code":"8076800195057","status":1,"product":{"code":"8076800195057","product_name":"Spaghetti",
                "product_name_it":"Spaghetti n.5","brands":"Barilla, Barilla Group","serving_quantity":"85",
                "nutriments":{"energy-kcal_100g":359,"proteins_100g":13,"carbohydrates_100g":"71","fat_100g":2,"sugars_100g":3.5}}}
            """.trimIndent(),
        )

        val lookup = repository.findByBarcode("8076800195057")

        val product = (lookup as ProductLookup.Found).product
        assertEquals(FoodId(FoodSource.PRODUCT, "8076800195057"), product.id)
        assertEquals("Spaghetti n.5", product.name)
        assertEquals("Barilla", product.brand)
        assertEquals(Nutrients(359.0, 13.0, 71.0, 2.0), product.per100g)
        assertEquals(85.0, product.servingGrams!!, 0.0)
        val request = server.takeRequest()
        assertEquals("/api/v2/product/8076800195057", request.url.encodedPath)
        assertTrue(request.headers["User-Agent"]!!.startsWith("Tracker-Android/"))
    }

    @Test
    fun `energy in kJ only is converted to kcal`() = runTest {
        respond(body = """{"status":1,"product":{"code":"1","product_name":"Crackers","nutriments":{"energy_100g":1841}}}""")

        val product = (repository.findByBarcode("1") as ProductLookup.Found).product

        assertEquals(440.0, product.per100g.kcal, 0.1)
    }

    @Test
    fun `unknown barcodes and products without energy are not found`() = runTest {
        respond(code = 404, body = """{"code":"123","status":0,"status_verbose":"product not found"}""")
        respond(body = """{"status":1,"product":{"code":"2","product_name":"Mystery","nutriments":{}}}""")

        assertEquals(ProductLookup.NotFound, repository.findByBarcode("123"))
        assertEquals(ProductLookup.NotFound, repository.findByBarcode("2"))
        assertEquals(ProductLookup.NotFound, repository.findByBarcode("not-a-barcode"))
    }

    @Test
    fun `server errors and garbage mean the service is unavailable`() = runTest {
        respond(code = 503, body = "<html>Page temporarily unavailable</html>")
        respond(body = "<html>not json</html>")

        assertEquals(ProductLookup.Unavailable, repository.findByBarcode("1"))
        assertEquals(ProductSearch.Unavailable, repository.search("pasta"))
    }

    @Test
    fun `search asks for Italian products and keeps the usable hits`() = runTest {
        respond(
            body = """
                {"hits":[
                  {"code":"8012666051236","product_name_it":"Yogurt greco magro","brands":["Carrefour"],
                   "nutriments":{"energy-kcal_100g":59,"proteins_100g":10,"carbohydrates_100g":4,"fat_100g":0.2}},
                  {"code":"3","product_name":"No nutrition"}
                ],"count":2}
            """.trimIndent(),
        )

        val results = (repository.search("yogurt greco") as ProductSearch.Results).products

        assertEquals(listOf("Yogurt greco magro"), results.map { it.name })
        assertEquals("Carrefour", results.single().brand)
        val request = server.takeRequest()
        assertEquals("/search", request.url.encodedPath)
        assertEquals("yogurt greco countries_tags:\"en:italy\"", request.url.queryParameter("q"))
        assertEquals("it", request.url.queryParameter("langs"))
    }
}
