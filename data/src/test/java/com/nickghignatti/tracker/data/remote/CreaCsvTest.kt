package com.nickghignatti.tracker.data.remote

import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Nutrients
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CreaCsvTest {

    @Test
    fun `quoted cells keep their commas and escaped quotes`() {
        assertEquals(
            listOf("005000", "Pasta di semola, cruda", "say \"hi\"", ""),
            parseCsvLine("005000,\"Pasta di semola, cruda\",\"say \"\"hi\"\"\","),
        )
    }

    @Test
    fun `rows become foods per 100 g, and rows without energy are skipped`() {
        val foods = parseCreaCsv(
            listOf(
                "code,name,name_en,category,portion_g,kcal,protein_g,fat_g,carbs_g,sugars_g,fiber_g,sodium_mg",
                "005000,Aglio,\"Garlic, raw\",Verdure e ortaggi,5,53,8.4,0.8,1.0,1.0,4.3,4",
                "001001,Acqua,Water,Bevande,,,,,,,,",
                "",
            ),
        )

        val garlic = foods.single()
        assertEquals(FoodId(FoodSource.BASIC, "005000"), garlic.id)
        assertEquals("Aglio", garlic.name)
        assertEquals(Nutrients(53.0, 8.4, 1.0, 0.8), garlic.per100g)
        assertEquals(5.0, garlic.servingGrams!!, 0.0)
        assertNull(garlic.brand)
    }
}
