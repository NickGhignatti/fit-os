package com.nickghignatti.tracker.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.PlanDay
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow

@Dao
internal interface WorkoutDao {
    @Transaction
    @Query("SELECT * FROM workouts WHERE date = :date ORDER BY id")
    fun observeWorkoutsOn(date: LocalDate): Flow<List<WorkoutWithExercises>>

    @Transaction
    @Query("SELECT * FROM workouts WHERE date = :date ORDER BY id")
    suspend fun getWorkoutsOn(date: LocalDate): List<WorkoutWithExercises>

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
internal interface TrainingPlanDao {
    @Transaction
    @Query("SELECT * FROM training_plans ORDER BY name COLLATE NOCASE")
    fun observePlans(): Flow<List<TrainingPlanWithExercises>>

    @Transaction
    @Query("SELECT * FROM training_plans WHERE id = :id")
    fun observePlan(id: Long): Flow<TrainingPlanWithExercises?>

    @Transaction
    @Query("SELECT * FROM training_plans WHERE isActive = 1 LIMIT 1")
    fun observeActivePlan(): Flow<TrainingPlanWithExercises?>

    @Transaction
    @Query("SELECT * FROM training_plans WHERE isActive = 1 LIMIT 1")
    suspend fun getActivePlan(): TrainingPlanWithExercises?

    @Insert
    suspend fun insertPlan(plan: TrainingPlanEntity): Long

    @Query("UPDATE training_plans SET name = :name WHERE id = :id")
    suspend fun renamePlan(id: Long, name: String)

    @Query("DELETE FROM training_plans WHERE id = :id")
    suspend fun deletePlan(id: Long)

    /** A null [id] matches no row, so every plan ends up inactive. */
    @Query("UPDATE training_plans SET isActive = CASE WHEN id = :id THEN 1 ELSE 0 END")
    suspend fun setActivePlan(id: Long?)

    @Insert
    suspend fun insertExercise(exercise: PlanExerciseEntity): Long

    @Query("UPDATE plan_exercises SET name = :name, notes = :notes WHERE id = :id")
    suspend fun updateExercise(id: Long, name: String, notes: String)

    @Query("DELETE FROM plan_exercises WHERE id = :id")
    suspend fun deleteExercise(id: Long)

    @Query("SELECT COALESCE(MAX(position), -1) + 1 FROM plan_exercises WHERE planId = :planId AND day = :day")
    suspend fun nextExercisePosition(planId: Long, day: PlanDay): Int

    @Insert
    suspend fun insertSets(sets: List<PlanSetEntity>)

    @Query("UPDATE plan_sets SET reps = :reps, weight = :weight WHERE id = :id")
    suspend fun updateSet(id: Long, reps: Int, weight: Double?)

    @Query("DELETE FROM plan_sets WHERE id = :id")
    suspend fun deleteSet(id: Long)

    @Query("SELECT COALESCE(MAX(position), -1) + 1 FROM plan_sets WHERE exerciseId = :exerciseId")
    suspend fun nextSetPosition(exerciseId: Long): Int
}

@Dao
internal interface DietPlanDao {
    @Transaction
    @Query("SELECT * FROM diet_plans ORDER BY name COLLATE NOCASE")
    fun observePlans(): Flow<List<DietPlanWithMeals>>

    @Transaction
    @Query("SELECT * FROM diet_plans WHERE id = :id")
    fun observePlan(id: Long): Flow<DietPlanWithMeals?>

    @Transaction
    @Query("SELECT * FROM diet_plans WHERE isActive = 1 LIMIT 1")
    fun observeActivePlan(): Flow<DietPlanWithMeals?>

    @Transaction
    @Query("SELECT * FROM diet_plans WHERE isActive = 1 LIMIT 1")
    suspend fun getActivePlan(): DietPlanWithMeals?

    @Insert
    suspend fun insertPlan(plan: DietPlanEntity): Long

    @Query("UPDATE diet_plans SET name = :name WHERE id = :id")
    suspend fun renamePlan(id: Long, name: String)

    @Query("DELETE FROM diet_plans WHERE id = :id")
    suspend fun deletePlan(id: Long)

    /** A null [id] matches no row, so every plan ends up inactive. */
    @Query("UPDATE diet_plans SET isActive = CASE WHEN id = :id THEN 1 ELSE 0 END")
    suspend fun setActivePlan(id: Long?)

    @Transaction
    @Query("SELECT * FROM meals WHERE planId = :planId AND day = :day ORDER BY position, id")
    suspend fun getMeals(planId: Long, day: PlanDay): List<MealWithFoods>

    @Insert
    suspend fun insertMeal(meal: MealEntity): Long

    @Query("UPDATE meals SET name = :name, time = :time WHERE id = :id")
    suspend fun updateMeal(id: Long, name: String, time: String)

    @Query("DELETE FROM meals WHERE id = :id")
    suspend fun deleteMeal(id: Long)

    @Query("DELETE FROM meals WHERE planId = :planId AND day = :day")
    suspend fun deleteMeals(planId: Long, day: PlanDay)

    @Query("SELECT COALESCE(MAX(position), -1) + 1 FROM meals WHERE planId = :planId AND day = :day")
    suspend fun nextMealPosition(planId: Long, day: PlanDay): Int

    @Insert
    suspend fun insertFoods(foods: List<FoodEntity>)

    @Query("SELECT * FROM foods WHERE id = :id")
    suspend fun getFood(id: Long): FoodEntity?

    @Update
    suspend fun updateFood(food: FoodEntity)

    @Query("DELETE FROM foods WHERE id = :id")
    suspend fun deleteFood(id: Long)

    @Query("SELECT COALESCE(MAX(position), -1) + 1 FROM foods WHERE mealId = :mealId")
    suspend fun nextFoodPosition(mealId: Long): Int
}

@Dao
internal interface FoodLogDao {
    @Query("SELECT * FROM food_log WHERE date = :date ORDER BY id")
    fun observeEntries(date: LocalDate): Flow<List<FoodLogEntity>>

    @Insert
    suspend fun insert(entry: FoodLogEntity): Long

    @Query("UPDATE food_log SET grams = :grams WHERE id = :id")
    suspend fun updateGrams(id: Long, grams: Double)

    @Query("DELETE FROM food_log WHERE id = :id")
    suspend fun delete(id: Long)

    /** SQLite takes the bare columns from the row holding MAX(id), i.e. the latest log of each food. */
    @Query(
        """
        SELECT foodId, name, brand, kcal, protein, carbs, fat, servingGrams, MAX(id) AS lastId
        FROM food_log GROUP BY foodId ORDER BY lastId DESC LIMIT :limit
        """,
    )
    fun observeRecentFoods(limit: Int): Flow<List<RecentFoodRow>>
}

@Dao
internal interface CustomFoodDao {
    @Query("SELECT * FROM custom_foods")
    suspend fun getAll(): List<CustomFoodEntity>

    @Insert
    suspend fun insert(food: CustomFoodEntity): Long
}

@Dao
internal interface FavoriteFoodDao {
    @Query("SELECT * FROM favorite_foods ORDER BY rowid DESC")
    fun observeAll(): Flow<List<FavoriteFoodEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(favorite: FavoriteFoodEntity)

    @Query("DELETE FROM favorite_foods WHERE foodId = :foodId")
    suspend fun delete(foodId: FoodId)
}

@Dao
internal interface SavedProductDao {
    @Query("SELECT * FROM saved_products")
    suspend fun getAll(): List<SavedProductEntity>

    @Query("SELECT * FROM saved_products WHERE foodId = :foodId")
    suspend fun find(foodId: FoodId): SavedProductEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(product: SavedProductEntity)
}
