package com.nickghignatti.tracker.domain.model

/** An exercise from the bundled catalogue (free-exercise-db), with how to perform it. */
data class ExerciseInfo(
    val id: String,
    val name: String,
    val category: ExerciseCategory,
    val level: ExerciseLevel,
    /** Null when the catalogue does not say. */
    val equipment: Equipment?,
    val primaryMuscles: List<Muscle>,
    val secondaryMuscles: List<Muscle>,
    val instructions: List<String>,
    /** Photos of the movement, usually its start and end position. */
    val imageUrls: List<String>,
)

enum class ExerciseCategory {
    STRENGTH,
    STRETCHING,
    PLYOMETRICS,
    POWERLIFTING,
    OLYMPIC_WEIGHTLIFTING,
    STRONGMAN,
    CARDIO,
}

enum class ExerciseLevel { BEGINNER, INTERMEDIATE, EXPERT }

enum class Equipment {
    BODY_ONLY,
    BARBELL,
    DUMBBELL,
    KETTLEBELLS,
    CABLE,
    MACHINE,
    BANDS,
    E_Z_CURL_BAR,
    MEDICINE_BALL,
    EXERCISE_BALL,
    FOAM_ROLL,
    OTHER,
}

enum class Muscle {
    ABDOMINALS,
    ABDUCTORS,
    ADDUCTORS,
    BICEPS,
    CALVES,
    CHEST,
    FOREARMS,
    GLUTES,
    HAMSTRINGS,
    LATS,
    LOWER_BACK,
    MIDDLE_BACK,
    NECK,
    QUADRICEPS,
    SHOULDERS,
    TRAPS,
    TRICEPS,
}

/** Filters for browsing the catalogue; null means any. */
data class ExerciseFilter(
    val muscle: Muscle? = null,
    val equipment: Equipment? = null,
) {
    fun matches(exercise: ExerciseInfo): Boolean =
        (muscle == null || muscle in exercise.primaryMuscles) && (equipment == null || equipment == exercise.equipment)
}
