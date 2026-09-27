package com.nickghignatti.tracker.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction
import java.time.DayOfWeek
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow

@Dao
internal interface WorkoutDao {
    @Transaction
    @Query("SELECT * FROM workouts WHERE date = :date ORDER BY id")
    fun observeWorkoutsOn(date: LocalDate): Flow<List<WorkoutWithExercises>>

    @Transaction
    @Query("SELECT * FROM workouts WHERE id = :id")
    suspend fun getWorkout(id: Long): WorkoutWithExercises?

    @Query(
        """
        SELECT w.date AS date,
               COUNT(s.id) AS totalSets,
               COALESCE(SUM(s.done), 0) AS doneSets
        FROM workouts w
        LEFT JOIN exercises e ON e.workoutId = w.id
        LEFT JOIN exercise_sets s ON s.exerciseId = e.id
        WHERE w.date BETWEEN :from AND :to
        GROUP BY w.date
        """,
    )
    fun observeDaySummaries(from: LocalDate, to: LocalDate): Flow<List<DaySummaryRow>>

    @Insert
    suspend fun insertWorkout(workout: WorkoutEntity): Long

    @Query("UPDATE workouts SET title = :title WHERE id = :id")
    suspend fun renameWorkout(id: Long, title: String)

    @Query("DELETE FROM workouts WHERE id = :id")
    suspend fun deleteWorkout(id: Long)

    @Insert
    suspend fun insertExercise(exercise: ExerciseEntity): Long

    @Query("UPDATE exercises SET name = :name, notes = :notes WHERE id = :id")
    suspend fun updateExercise(id: Long, name: String, notes: String)

    @Query("DELETE FROM exercises WHERE id = :id")
    suspend fun deleteExercise(id: Long)

    @Query("SELECT COALESCE(MAX(position), -1) + 1 FROM exercises WHERE workoutId = :workoutId")
    suspend fun nextExercisePosition(workoutId: Long): Int

    @Insert
    suspend fun insertSets(sets: List<SetEntity>)

    @Query(
        """
        UPDATE exercise_sets
        SET plannedReps = :plannedReps, plannedWeight = :plannedWeight,
            actualReps = :actualReps, actualWeight = :actualWeight, done = :done
        WHERE id = :id
        """,
    )
    suspend fun updateSet(
        id: Long,
        plannedReps: Int,
        plannedWeight: Double?,
        actualReps: Int?,
        actualWeight: Double?,
        done: Boolean,
    )

    @Query("DELETE FROM exercise_sets WHERE id = :id")
    suspend fun deleteSet(id: Long)

    @Query("SELECT COALESCE(MAX(position), -1) + 1 FROM exercise_sets WHERE exerciseId = :exerciseId")
    suspend fun nextSetPosition(exerciseId: Long): Int
}

@Dao
internal interface TemplateDao {
    @Transaction
    @Query("SELECT * FROM templates ORDER BY name COLLATE NOCASE")
    fun observeTemplates(): Flow<List<TemplateWithExercises>>

    @Transaction
    @Query("SELECT * FROM templates WHERE id = :id")
    suspend fun getTemplate(id: Long): TemplateWithExercises?

    @Insert
    suspend fun insertTemplate(template: TemplateEntity): Long

    @Insert
    suspend fun insertExercise(exercise: TemplateExerciseEntity): Long

    @Insert
    suspend fun insertSets(sets: List<TemplateSetEntity>)

    @Query("UPDATE templates SET name = :name WHERE id = :id")
    suspend fun renameTemplate(id: Long, name: String)

    @Query("DELETE FROM templates WHERE id = :id")
    suspend fun deleteTemplate(id: Long)
}

@Dao
internal interface DietDao {
    @Transaction
    @Query("SELECT * FROM meals WHERE dayOfWeek = :day ORDER BY position, id")
    fun observeMeals(day: DayOfWeek): Flow<List<MealWithFoods>>

    @Transaction
    @Query("SELECT * FROM meals WHERE dayOfWeek = :day ORDER BY position, id")
    suspend fun getMeals(day: DayOfWeek): List<MealWithFoods>

    @Insert
    suspend fun insertMeal(meal: MealEntity): Long

    @Query("UPDATE meals SET name = :name, time = :time WHERE id = :id")
    suspend fun updateMeal(id: Long, name: String, time: String)

    @Query("DELETE FROM meals WHERE id = :id")
    suspend fun deleteMeal(id: Long)

    @Query("DELETE FROM meals WHERE dayOfWeek = :day")
    suspend fun deleteMealsOn(day: DayOfWeek)

    @Query("SELECT COALESCE(MAX(position), -1) + 1 FROM meals WHERE dayOfWeek = :day")
    suspend fun nextMealPosition(day: DayOfWeek): Int

    @Insert
    suspend fun insertFoods(foods: List<FoodEntity>)

    @Query("UPDATE foods SET name = :name, quantity = :quantity WHERE id = :id")
    suspend fun updateFood(id: Long, name: String, quantity: String)

    @Query("DELETE FROM foods WHERE id = :id")
    suspend fun deleteFood(id: Long)

    @Query("SELECT COALESCE(MAX(position), -1) + 1 FROM foods WHERE mealId = :mealId")
    suspend fun nextFoodPosition(mealId: Long): Int
}
