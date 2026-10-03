package com.nickghignatti.tracker.ui.exercises

import androidx.annotation.StringRes
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Equipment
import com.nickghignatti.tracker.domain.model.ExerciseCategory
import com.nickghignatti.tracker.domain.model.ExerciseInfo
import com.nickghignatti.tracker.domain.model.ExerciseLevel
import com.nickghignatti.tracker.domain.model.Muscle

@StringRes
fun Muscle.label(): Int = when (this) {
    Muscle.ABDOMINALS -> R.string.muscle_abdominals
    Muscle.ABDUCTORS -> R.string.muscle_abductors
    Muscle.ADDUCTORS -> R.string.muscle_adductors
    Muscle.BICEPS -> R.string.muscle_biceps
    Muscle.CALVES -> R.string.muscle_calves
    Muscle.CHEST -> R.string.muscle_chest
    Muscle.FOREARMS -> R.string.muscle_forearms
    Muscle.GLUTES -> R.string.muscle_glutes
    Muscle.HAMSTRINGS -> R.string.muscle_hamstrings
    Muscle.LATS -> R.string.muscle_lats
    Muscle.LOWER_BACK -> R.string.muscle_lower_back
    Muscle.MIDDLE_BACK -> R.string.muscle_middle_back
    Muscle.NECK -> R.string.muscle_neck
    Muscle.QUADRICEPS -> R.string.muscle_quadriceps
    Muscle.SHOULDERS -> R.string.muscle_shoulders
    Muscle.TRAPS -> R.string.muscle_traps
    Muscle.TRICEPS -> R.string.muscle_triceps
}

@StringRes
fun Equipment.label(): Int = when (this) {
    Equipment.BODY_ONLY -> R.string.equipment_body_only
    Equipment.BARBELL -> R.string.equipment_barbell
    Equipment.DUMBBELL -> R.string.equipment_dumbbell
    Equipment.KETTLEBELLS -> R.string.equipment_kettlebells
    Equipment.CABLE -> R.string.equipment_cable
    Equipment.MACHINE -> R.string.equipment_machine
    Equipment.BANDS -> R.string.equipment_bands
    Equipment.E_Z_CURL_BAR -> R.string.equipment_ez_bar
    Equipment.MEDICINE_BALL -> R.string.equipment_medicine_ball
    Equipment.EXERCISE_BALL -> R.string.equipment_exercise_ball
    Equipment.FOAM_ROLL -> R.string.equipment_foam_roll
    Equipment.OTHER -> R.string.equipment_other
}

@StringRes
fun ExerciseLevel.label(): Int = when (this) {
    ExerciseLevel.BEGINNER -> R.string.level_beginner
    ExerciseLevel.INTERMEDIATE -> R.string.level_intermediate
    ExerciseLevel.EXPERT -> R.string.level_expert
}

@StringRes
fun ExerciseCategory.label(): Int = when (this) {
    ExerciseCategory.STRENGTH -> R.string.category_strength
    ExerciseCategory.STRETCHING -> R.string.category_stretching
    ExerciseCategory.PLYOMETRICS -> R.string.category_plyometrics
    ExerciseCategory.POWERLIFTING -> R.string.category_powerlifting
    ExerciseCategory.OLYMPIC_WEIGHTLIFTING -> R.string.category_olympic
    ExerciseCategory.STRONGMAN -> R.string.category_strongman
    ExerciseCategory.CARDIO -> R.string.category_cardio
}

/** "Chest, Triceps · Barbell". */
@Composable
fun exerciseSummary(exercise: ExerciseInfo): String {
    val muscles = exercise.primaryMuscles.map { stringResource(it.label()) }.joinToString(", ")
    return listOfNotNull(muscles, exercise.equipment?.let { stringResource(it.label()) }).joinToString(" · ")
}

/** Opens the catalogue page of an exercise picked from it. */
@Composable
fun HowToButton(exerciseName: String, onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(painterResource(R.drawable.ic_info), stringResource(R.string.exercises_how_to, exerciseName))
    }
}
