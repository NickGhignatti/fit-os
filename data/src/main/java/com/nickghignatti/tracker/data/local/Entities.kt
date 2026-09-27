package com.nickghignatti.tracker.data.local

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Relation
import java.time.DayOfWeek
import java.time.LocalDate

// `position` columns keep the user's ordering; mappers sort by them.

// ---- Workouts ---------------------------------------------------------------

@Entity(tableName = "workouts", indices = [Index("date")])
internal data class WorkoutEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val date: LocalDate,
    val title: String,
)

@Entity(
    tableName = "exercises",
    foreignKeys = [
        ForeignKey(
            entity = WorkoutEntity::class,
            parentColumns = ["id"],
            childColumns = ["workoutId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("workoutId")],
)
internal data class ExerciseEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val workoutId: Long,
    val position: Int,
    val name: String,
    val notes: String,
)

@Entity(
    tableName = "exercise_sets",
    foreignKeys = [
        ForeignKey(
            entity = ExerciseEntity::class,
            parentColumns = ["id"],
            childColumns = ["exerciseId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("exerciseId")],
)
internal data class SetEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val exerciseId: Long,
    val position: Int,
    val plannedReps: Int,
    val plannedWeight: Double?,
    val actualReps: Int? = null,
    val actualWeight: Double? = null,
    val done: Boolean = false,
)

internal data class ExerciseWithSets(
    @Embedded val exercise: ExerciseEntity,
    @Relation(parentColumn = "id", entityColumn = "exerciseId")
    val sets: List<SetEntity>,
)

internal data class WorkoutWithExercises(
    @Embedded val workout: WorkoutEntity,
    @Relation(entity = ExerciseEntity::class, parentColumn = "id", entityColumn = "workoutId")
    val exercises: List<ExerciseWithSets>,
)

internal data class DaySummaryRow(
    val date: LocalDate,
    val totalSets: Int,
    val doneSets: Int,
)

// ---- Templates --------------------------------------------------------------

@Entity(tableName = "templates")
internal data class TemplateEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
)

@Entity(
    tableName = "template_exercises",
    foreignKeys = [
        ForeignKey(
            entity = TemplateEntity::class,
            parentColumns = ["id"],
            childColumns = ["templateId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("templateId")],
)
internal data class TemplateExerciseEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val templateId: Long,
    val position: Int,
    val name: String,
    val notes: String,
)

@Entity(
    tableName = "template_sets",
    foreignKeys = [
        ForeignKey(
            entity = TemplateExerciseEntity::class,
            parentColumns = ["id"],
            childColumns = ["templateExerciseId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("templateExerciseId")],
)
internal data class TemplateSetEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val templateExerciseId: Long,
    val position: Int,
    val reps: Int,
    val weight: Double?,
)

internal data class TemplateExerciseWithSets(
    @Embedded val exercise: TemplateExerciseEntity,
    @Relation(parentColumn = "id", entityColumn = "templateExerciseId")
    val sets: List<TemplateSetEntity>,
)

internal data class TemplateWithExercises(
    @Embedded val template: TemplateEntity,
    @Relation(entity = TemplateExerciseEntity::class, parentColumn = "id", entityColumn = "templateId")
    val exercises: List<TemplateExerciseWithSets>,
)

// ---- Diet -------------------------------------------------------------------

@Entity(tableName = "meals", indices = [Index("dayOfWeek")])
internal data class MealEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val dayOfWeek: DayOfWeek,
    val position: Int,
    val name: String,
    val time: String,
)

@Entity(
    tableName = "foods",
    foreignKeys = [
        ForeignKey(
            entity = MealEntity::class,
            parentColumns = ["id"],
            childColumns = ["mealId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("mealId")],
)
internal data class FoodEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val mealId: Long,
    val position: Int,
    val name: String,
    val quantity: String,
)

internal data class MealWithFoods(
    @Embedded val meal: MealEntity,
    @Relation(parentColumn = "id", entityColumn = "mealId")
    val foods: List<FoodEntity>,
)
