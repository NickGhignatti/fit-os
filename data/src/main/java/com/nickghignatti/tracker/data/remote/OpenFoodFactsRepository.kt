package com.nickghignatti.tracker.data.remote

import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.repository.ProductLookup
import com.nickghignatti.tracker.domain.repository.ProductRepository
import com.nickghignatti.tracker.domain.repository.ProductSearch
import java.io.IOException
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request

/** Where the Open Food Facts APIs live; tests point these at a local server. */
internal class OpenFoodFactsEndpoints(val products: HttpUrl, val search: HttpUrl)

/**
 * Packaged products from Open Food Facts (ODbL). Barcodes use the product API; names use the
 * search API restricted to products sold in Italy, with Italian names preferred.
 */
internal class OpenFoodFactsRepository @Inject constructor(
    private val client: OkHttpClient,
    private val json: Json,
    private val endpoints: OpenFoodFactsEndpoints,
) : ProductRepository {

    override suspend fun findByBarcode(barcode: String): ProductLookup {
        if (!barcode.all(Char::isDigit) || barcode.isEmpty()) return ProductLookup.NotFound
        val url = endpoints.products.newBuilder()
            .addPathSegments("api/v2/product")
            .addPathSegment(barcode)
            .addQueryParameter("fields", FIELDS)
            .build()
        val response = get<ProductResponse>(url, acceptNotFound = true) ?: return ProductLookup.Unavailable
        val product = response.product?.takeIf { response.status == 1 }?.toFoodItem()
        return product?.let(ProductLookup::Found) ?: ProductLookup.NotFound
    }

    override suspend fun search(query: String): ProductSearch {
        val url = endpoints.search.newBuilder()
            .addPathSegment("search")
            .addQueryParameter("q", "$query countries_tags:\"en:italy\"")
            .addQueryParameter("langs", "it")
            .addQueryParameter("page_size", PAGE_SIZE.toString())
            .addQueryParameter("fields", FIELDS)
            .build()
        val response = get<SearchResponse>(url) ?: return ProductSearch.Unavailable
        return ProductSearch.Results(response.hits.mapNotNull { it.toFoodItem() })
    }

    /** Null when the service cannot be reached or answers with an error. */
    private suspend inline fun <reified T> get(url: HttpUrl, acceptNotFound: Boolean = false): T? =
        withContext(Dispatchers.IO) {
            try {
                client.newCall(Request.Builder().url(url).build()).execute().use { response ->
                    val usable = response.isSuccessful || (acceptNotFound && response.code == HTTP_NOT_FOUND)
                    if (usable) json.decodeFromString<T>(response.body.string()) else null
                }
            } catch (_: IOException) {
                null
            } catch (_: SerializationException) {
                null
            }
        }

    private companion object {
        const val FIELDS = "code,product_name,product_name_it,brands,nutriments,serving_quantity"
        const val PAGE_SIZE = 20
        const val HTTP_NOT_FOUND = 404
        const val KJ_PER_KCAL = 4.184
    }

    @Serializable
    private class ProductResponse(val status: Int = 0, val product: ProductDto? = null)

    @Serializable
    private class SearchResponse(val hits: List<ProductDto> = emptyList())

    @Serializable
    private class ProductDto(
        val code: String? = null,
        @SerialName("product_name") val name: String? = null,
        @SerialName("product_name_it") val italianName: String? = null,
        /** A comma-separated string from the product API, a list from the search API. */
        val brands: JsonElement? = null,
        val nutriments: NutrimentsDto? = null,
        @SerialName("serving_quantity") val servingQuantity: JsonElement? = null,
    ) {
        /** Null for products without a name or an energy value: they cannot be logged. */
        fun toFoodItem(): FoodItem? {
            val code = code?.takeIf { it.isNotBlank() } ?: return null
            val displayName = italianName?.takeIf { it.isNotBlank() } ?: name?.takeIf { it.isNotBlank() } ?: return null
            val nutrition = nutriments ?: return null
            val kcal = nutrition.kcal ?: nutrition.kj?.div(KJ_PER_KCAL) ?: return null
            return FoodItem(
                id = FoodId(FoodSource.PRODUCT, code),
                name = displayName.trim(),
                per100g = Nutrients(kcal, nutrition.protein ?: 0.0, nutrition.carbs ?: 0.0, nutrition.fat ?: 0.0),
                brand = firstBrand(),
                servingGrams = (servingQuantity as? JsonPrimitive)?.content?.toDoubleOrNull()?.takeIf { it > 0 },
            )
        }

        private fun firstBrand(): String? = when (val value = brands) {
            is JsonPrimitive -> value.content.substringBefore(',')
            is JsonArray -> (value.firstOrNull() as? JsonPrimitive)?.content
            else -> null
        }?.trim()?.takeIf { it.isNotEmpty() }
    }

    @Serializable
    private class NutrimentsDto(
        @SerialName("energy-kcal_100g") val kcal: Double? = null,
        @SerialName("energy_100g") val kj: Double? = null,
        @SerialName("proteins_100g") val protein: Double? = null,
        @SerialName("carbohydrates_100g") val carbs: Double? = null,
        @SerialName("fat_100g") val fat: Double? = null,
    )
}
