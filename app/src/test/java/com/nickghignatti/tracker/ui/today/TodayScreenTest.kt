package com.nickghignatti.tracker.ui.today

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.nickghignatti.tracker.domain.model.DayAgenda
import com.nickghignatti.tracker.domain.model.ExercisePlan
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.PendingSession
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

    private fun show(agenda: DayAgenda, onAction: (TodayAction) -> Unit = {}, onOpenTraining: () -> Unit = {}) {
        compose.setContent {
            TrackerTheme {
                TodayScreen(
                    state = TodayUiState(agenda, isLoading = false),
                    onAction = onAction,
                    onOpenDay = {},
                    onOpenTraining = onOpenTraining,
                    onOpenDiet = {},
                )
            }
        }
    }

    @Test
    fun `shows a workout and a meal that share the same database id`() {
        // Workouts and meals live in different tables, so ids overlap; the list must still render.
        show(
            DayAgenda(
                date = today,
                workouts = listOf(Workout(id = 1, date = today, title = "Push day", exercises = emptyList())),
                meals = listOf(Meal(id = 1, name = "Breakfast", time = "08:00", foods = listOf(Food(1, "Oats", "80 g")))),
                hasTrainingPlan = true,
                hasDietPlan = true,
            ),
        )

        compose.onNodeWithText("Push day").assertIsDisplayed()
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
        compose.onNodeWithText("Start workout").performClick()

        assertEquals(listOf(TodayAction.StartPlannedSession), actions)
    }

    @Test
    fun `without an active plan it points to the Training tab`() {
        var opened = false
        show(DayAgenda(date = today), onOpenTraining = { opened = true })

        compose.onNodeWithText("Choose a workout").performClick()

        assertTrue(opened)
    }
}
