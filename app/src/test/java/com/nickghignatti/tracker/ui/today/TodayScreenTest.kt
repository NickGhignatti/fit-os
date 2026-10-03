package com.nickghignatti.tracker.ui.today

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.ui.theme.TrackerTheme
import java.time.LocalDate
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

    @Test
    fun `shows a workout and a meal that share the same database id`() {
        // Workouts and meals live in different tables, so ids overlap; the list must still render.
        val state = TodayUiState(
            date = today,
            workouts = listOf(Workout(id = 1, date = today, title = "Push day", exercises = emptyList())),
            meals = listOf(Meal(id = 1, day = today.dayOfWeek, name = "Breakfast", time = "08:00", foods = listOf(Food(1, "Oats", "80 g")))),
            isLoading = false,
        )

        compose.setContent { TrackerTheme { TodayScreen(state, onOpenDay = {}, onOpenDiet = {}) } }

        compose.onNodeWithText("Push day").assertIsDisplayed()
        compose.onNodeWithText("Breakfast").assertIsDisplayed()
        compose.onNodeWithText("Oats").assertIsDisplayed()
    }
}
