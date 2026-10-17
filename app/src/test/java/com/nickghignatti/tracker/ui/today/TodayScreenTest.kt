package com.nickghignatti.tracker.ui.today

import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import com.nickghignatti.tracker.domain.model.CalorieDay
import com.nickghignatti.tracker.domain.model.DayAgenda
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.FoodId
import com.nickghignatti.tracker.domain.model.FoodItem
import com.nickghignatti.tracker.domain.model.FoodSource
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.MealLog
import com.nickghignatti.tracker.domain.model.Nutrients
import com.nickghignatti.tracker.domain.model.PendingSession
import com.nickghignatti.tracker.domain.model.Portion
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.ui.theme.TrackerTheme
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class TodayScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val today = LocalDate.of(2026, 9, 27)

    private fun show(
        agenda: DayAgenda,
        calories: CalorieDay = CalorieDay(today, emptyList()),
        onAction: (TodayAction) -> Unit = {},
        onOpenTraining: () -> Unit = {},
    ) {
        compose.setContent {
            TrackerTheme {
                TodayScreen(
                    state = TodayUiState(agenda, calories, isLoading = false),
                    onAction = onAction,
                    onOpenDay = {},
                    onOpenTraining = onOpenTraining,
                    onOpenDiet = {},
                )
            }
        }
    }

    /** The list is taller than the test screen, so bring the item into view first. */
    private fun scrollTo(text: String) {
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun `shows a workout and a meal that share the same database id`() {
        // Workouts and meals live in different tables, so ids overlap; the list must still render.
        val breakfast = Meal(id = 1, name = "Breakfast", time = "08:00", foods = listOf(Food(1, "Oats", "80 g")))
        show(
            DayAgenda(
                date = today,
                workouts = listOf(Workout(id = 1, date = today, title = "Push day", exercises = emptyList())),
                meals = listOf(breakfast),
                hasTrainingPlan = true,
                hasDietPlan = true,
            ),
            calories = CalorieDay(today, listOf(MealLog("Breakfast", breakfast)), hasDietPlan = true),
        )

        compose.onNodeWithText("Push day").assertIsDisplayed()
        scrollTo("Breakfast")
        compose.onNodeWithText("Breakfast").assertIsDisplayed()
        compose.onNodeWithText("Oats").assertIsDisplayed()
    }

    @Test
    fun `the planned session can be started`() {
        val actions = mutableListOf<TodayAction>()
        show(
            DayAgenda(
                date = today,
                pendingSession = PendingSession(1, "Leg day", listOf(ExercisePlan.uniform("Squat", "", 3, 5, 100.0))),
                hasTrainingPlan = true,
            ),
            onAction = { actions += it },
        )

        compose.onNodeWithText("Leg day").assertIsDisplayed()
        scrollTo("Start workout")
        compose.onNodeWithText("Start workout").performClick()

        assertEquals(listOf(TodayAction.StartPlannedSession), actions)
    }

    @Test
    fun `an unlogged planned meal can be ticked to log it`() {
        val actions = mutableListOf<TodayAction>()
        val oats = FoodItem(FoodId(FoodSource.BASIC, "1"), "Oats", Nutrients(370.0, 13.0, 60.0, 7.0))
        val breakfast = Meal(1, "Breakfast", "08:00", listOf(Food(1, "Oats", "", Portion(oats, 50.0))))
        show(
            DayAgenda(date = today, meals = listOf(breakfast), hasDietPlan = true),
            calories = CalorieDay(today, listOf(MealLog("Breakfast", breakfast)), hasDietPlan = true),
            onAction = { actions += it },
        )

        scrollTo("Oats")
        compose.onNodeWithText("Oats").assertIsDisplayed()
        compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox)).performClick()

        assertEquals(listOf(TodayAction.LogMeal(breakfast)), actions)
    }

    @Test
    fun `without an active plan it points to the Training tab`() {
        var opened = false
        show(DayAgenda(date = today), onOpenTraining = { opened = true })

        compose.onNodeWithText("Choose a workout").performClick()

        assertTrue(opened)
    }
}
