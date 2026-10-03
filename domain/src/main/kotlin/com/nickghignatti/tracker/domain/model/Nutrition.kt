package com.nickghignatti.tracker.domain.model

/** Energy in kcal and macronutrients in grams, for some amount of food. */
data class Nutrients(
    val kcal: Double,
    val protein: Double,
    val carbs: Double,
    val fat: Double,
) {
    operator fun plus(other: Nutrients) =
        Nutrients(kcal + other.kcal, protein + other.protein, carbs + other.carbs, fat + other.fat)

    operator fun times(factor: Double) = Nutrients(kcal * factor, protein * factor, carbs * factor, fat * factor)

    companion object {
        val ZERO = Nutrients(0.0, 0.0, 0.0, 0.0)
    }
}

fun Iterable<Nutrients>.sum(): Nutrients = fold(Nutrients.ZERO, Nutrients::plus)

/** Where a food's nutrition data comes from. */
enum class FoodSource(val prefix: String) {
    /** The CREA food composition tables, bundled with the app. */
    BASIC("crea"),

    /** A packaged product from Open Food Facts, found by barcode or name. */
    PRODUCT("off"),

    /** A food the user entered. */
    CUSTOM("custom"),
}

/** A stable reference to a food in its source, written as e.g. "crea:005000" or "off:8076800195057". */
data class FoodId(val source: FoodSource, val key: String) {
    override fun toString() = "${source.prefix}:$key"

    companion object {
        fun parse(value: String): FoodId {
            val prefix = value.substringBefore(':')
            val source = requireNotNull(FoodSource.entries.find { it.prefix == prefix }) { "unknown food source in $value" }
            return FoodId(source, value.substringAfter(':'))
        }
    }
}

/** A food with known nutrition per 100 g. */
data class FoodItem(
    val id: FoodId,
    val name: String,
    val per100g: Nutrients,
    val brand: String? = null,
    /** A typical serving in grams, when the source gives one. */
    val servingGrams: Double? = null,
)

/** An amount of a food. It carries the food's data, so its nutrition never needs looking up again. */
data class Portion(val food: FoodItem, val grams: Double) {
    init {
        require(grams > 0) { "grams must be positive, was $grams" }
    }

    val nutrients: Nutrients get() = food.per100g * (grams / 100)
}
