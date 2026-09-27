package com.nickghignatti.tracker.ui.templates

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeTemplateRepository
import com.nickghignatti.tracker.domain.fake.FakeWorkoutRepository
import com.nickghignatti.tracker.domain.fake.ImmediateTransactionRunner
import com.nickghignatti.tracker.domain.usecase.ApplyTemplateUseCase
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TemplatesViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val today = LocalDate.of(2026, 9, 26)
    private val clock = Clock.fixed(today.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val workouts = FakeWorkoutRepository()
    private val templates = FakeTemplateRepository()
    // Created lazily so viewModelScope binds to the dispatcher installed by the rule.
    private val viewModel by lazy { TemplatesViewModel(clock, templates, ApplyTemplateUseCase(templates, workouts, ImmediateTransactionRunner())) }

    @Test
    fun `lists templates by name`() = runTest {
        templates.createTemplate("push", emptyList())
        templates.createTemplate("Legs", emptyList())
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        assertEquals(listOf("Legs", "push"), viewModel.uiState.value.templates.map { it.name })
        assertEquals(today, viewModel.uiState.value.today)
    }

    @Test
    fun `applying creates the workout, then asks to open its day`() = runTest {
        val id = templates.createTemplate("Legs", emptyList())
        val date = today.plusDays(3)

        viewModel.onAction(TemplatesAction.ApplyToDay(id, date))

        assertEquals(TemplatesEvent.TemplateApplied(date), viewModel.events.first())
        assertEquals(date, workouts.workouts.single().date)
    }

    @Test
    fun `rename trims and delete removes`() = runTest {
        val id = templates.createTemplate("Legs", emptyList())

        viewModel.onAction(TemplatesAction.Rename(id, " Leg day "))
        assertEquals("Leg day", templates.templates.single().name)

        viewModel.onAction(TemplatesAction.Delete(id))
        assertTrue(templates.templates.isEmpty())
    }
}
