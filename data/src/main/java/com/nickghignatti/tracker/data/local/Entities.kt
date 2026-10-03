package com.nickghignatti.tracker.data.local

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Relation
import com.nickghignatti.tracker.domain.model.PlanDay
import com.nickghignatti.tracker.domain.model.Recurrence
import java.time.LocalDate

// `position` columns keep the user's ordering; mappers sort by them.

// ---- Workouts ---------------------------------------------------------------

@Entity(
    tableName = "workouts",
    foreignKeys = [
        ForeignKey(
            entity = TrainingPlanEntity::class,
            parentColumns = ["id"],
            childColumns = ["planId"],
            onDelete = ForeignKey.SET_NULL,
        ),
    ],
    indices = [Index("date"), Index("planId")],
)
internal data class WorkoutEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val date: LocalDate,
    val title: String,
    /** The training plan it was started from; kept as history if the plan is deleted. */
    val planId: Long? = null,
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

// ---- Training plans ---------------------------------------------------------

@Entity(tableName = "training_plans")
internal data class TrainingPlanEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val recurrence: Recurrence,
    val isActive: Boolean = false,
)

@Entity(
    tableName = "plan_exercises",
    foreignKeys = [
        ForeignKey(
            entity = TrainingPlanEntity::class,
            parentColumns = ["id"],
            childColumns = ["planId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("planId")],
)
internal data class PlanExerciseEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val planId: Long,
    val day: PlanDay,
    val position: Int,
    val name: String,
    val notes: String,
)

@Entity(
    tableName = "plan_sets",
    foreignKeys = [
        ForeignKey(
            entity = PlanExerciseEntity::class,
            parentColumns = ["id"],
            childColumns = ["exerciseId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("exerciseId")],
)
internal data class PlanSetEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val exerciseId: Long,
    val position: Int,
    val reps: Int,
    val weight: Double?,
)

internal data class PlanExerciseWithSets(
    @Embedded val exercise: PlanExerciseEntity,
    @Relation(parentColumn = "id", entityColumn = "exerciseId")
    val sets: List<PlanSetEntity>,
)

internal data class TrainingPlanWithExercises(
    @Embedded val plan: TrainingPlanEntity,
    @Relation(entity = PlanExerciseEntity::class, parentColumn = "id", entityColumn = "planId")
    val exercises: List<PlanExerciseWithSets>,
)

// ---- Diet plans -------------------------------------------------------------

@Entity(tableName = "diet_plans")
internal data class DietPlanEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val recurrence: Recurrence,
    val isActive: Boolean = false,
)

@Entity(
    tableName = "meals",
    foreignKeys = [
        ForeignKey(
            entity = DietPlanEntity::class,
            parentColumns = ["id"],
            childColumns = ["planId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("planId")],
)
internal data class MealEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val planId: Long,
    val day: PlanDay,
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

internal data class DietPlanWithMeals(
    @Embedded val plan: DietPlanEntity,
    @Relation(entity = MealEntity::class, parentColumn = "id", entityColumn = "planId")
    val meals: List<MealWithFoods>,
)
