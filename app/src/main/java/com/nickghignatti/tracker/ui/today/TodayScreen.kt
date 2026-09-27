@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.domain.model.Exercise
import com.nickghignatti.tracker.domain.model.ExerciseSet
import com.nickghignatti.tracker.domain.model.Food
import com.nickghignatti.tracker.domain.model.Meal
import com.nickghignatti.tracker.domain.model.Workout
import com.nickghignatti.tracker.ui.components.SectionHeader
import com.nickghignatti.tracker.ui.diet.MealCard
import com.nickghignatti.tracker.ui.format.displayName
import com.nickghignatti.tracker.ui.format.formatted
import com.nickghignatti.tracker.ui.theme.TrackerTheme
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.FormatStyle

@Composable
fun TodayScreen(
    onOpenDay: (LocalDate) -> Unit,
    onOpenDiet: () -> Unit,
    viewModel: TodayViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    TodayScreen(state, onOpenDay, onOpenDiet)
}

@Composable
internal fun TodayScreen(
    state: TodayUiState,
    onOpenDay: (LocalDate) -> Unit,
    onOpenDiet: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(stringResource(R.string.today_title))
                        Text(
                            state.date.formatted(FormatStyle.FULL),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
            )
        },
    ) { padding ->
        if (state.isLoading) return@Scaffold
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { SectionHeader(stringResource(R.string.today_section_training), R.drawable.ic_fitness) }
            if (state.workouts.isEmpty()) {
                item {
                    Placeholder(
                        text = stringResource(R.string.today_rest_day),
                        action = stringResource(R.string.today_plan_workout),
                        onAction = { onOpenDay(state.date) },
                    )
                }
            } else {
                items(state.workouts, key = { it.id }) { workout ->
                    WorkoutSummaryCard(workout, onClick = { onOpenDay(state.date) })
                }
            }

            item {
                SectionHeader(
                    stringResource(R.string.today_section_meals, state.date.dayOfWeek.displayName()),
                    R.drawable.ic_restaurant,
                )
            }
            if (state.meals.isEmpty()) {
                item {
                    Placeholder(
                        text = stringResource(R.string.today_no_meals),
                        action = stringResource(R.string.today_set_up_diet),
                        onAction = onOpenDiet,
                    )
                }
            } else {
                items(state.meals, key = { it.id }) { meal -> MealCard(meal) }
            }
        }
    }
}

@Composable
private fun WorkoutSummaryCard(workout: Workout, onClick: () -> Unit) {
    ElevatedCard(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row {
                Text(workout.title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                if (workout.totalSets > 0) {
                    Text(
                        stringResource(R.string.progress_ratio, workout.doneSets, workout.totalSets),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            if (workout.totalSets > 0) {
                LinearProgressIndicator(
                    progress = { workout.doneSets.toFloat() / workout.totalSets },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            workout.exercises.forEach { exercise ->
                Row {
                    Text(exercise.name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    Text(
                        stringResource(R.string.today_exercise_progress, exercise.doneSets, exercise.sets.size),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (workout.exercises.isEmpty()) {
                Text(
                    stringResource(R.string.today_no_exercises),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun Placeholder(text: String, action: String, onAction: () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(start = 16.dp, top = 16.dp, end = 8.dp, bottom = 4.dp)) {
            Text(text, style = MaterialTheme.typography.bodyLarge)
            TextButton(onClick = onAction) { Text(action) }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun TodayScreenPreview() {
    val squat = Exercise(
        id = 1,
        name = "Squat",
        notes = "",
        sets = List(3) { ExerciseSet(id = it.toLong(), plannedReps = 5, plannedWeight = 100.0, done = it == 0) },
    )
    TrackerTheme {
        TodayScreen(
            state = TodayUiState(
                date = LocalDate.of(2026, 9, 26),
                workouts = listOf(Workout(1, LocalDate.of(2026, 9, 26), "Legs", listOf(squat))),
                meals = listOf(Meal(1, DayOfWeek.SATURDAY, "Breakfast", "08:00", listOf(Food(1, "Oats", "80 g")))),
                isLoading = false,
            ),
            onOpenDay = {},
            onOpenDiet = {},
        )
    }
}
