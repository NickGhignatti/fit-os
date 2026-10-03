package com.nickghignatti.tracker.ui.plans

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeTrainingPlanRepository
import com.nickghignatti.tracker.domain.model.Recurrence
import com.nickghignatti.tracker.ui.training.TrainingPlansViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PlanListViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val plans = FakeTrainingPlanRepository()
    // Created lazily so viewModelScope binds to the dispatcher installed by the rule.
    private val viewModel by lazy { TrainingPlansViewModel(plans) }

    @Test
    fun `lists plans by name`() = runTest {
        plans.createPlan("push", Recurrence.DAILY)
        plans.createPlan("Legs", Recurrence.WEEKLY)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        assertEquals(listOf("Legs", "push"), viewModel.uiState.value.plans.map { it.name })
    }

    @Test
    fun `creating a plan trims its name, then asks to open it`() = runTest {
        viewModel.onAction(PlanListAction.Create(" Split ", Recurrence.WEEKLY))

        val created = plans.plans.single()
        assertEquals(PlanListEvent.PlanCreated(created.id), viewModel.events.first())
        assertEquals("Split", created.name)
        assertEquals(Recurrence.WEEKLY, created.recurrence)
    }

    @Test
    fun `activating one plan deactivates the others`() = runTest {
        val a = plans.createPlan("A", Recurrence.DAILY)
        val b = plans.createPlan("B", Recurrence.DAILY)

        viewModel.onAction(PlanListAction.Activate(a))
        viewModel.onAction(PlanListAction.Activate(b))
        assertEquals(b, plans.getActivePlan()?.id)

        viewModel.onAction(PlanListAction.Deactivate)
        assertNull(plans.getActivePlan())
    }

    @Test
    fun `rename trims and delete removes`() = runTest {
        val id = plans.createPlan("Legs", Recurrence.DAILY)

        viewModel.onAction(PlanListAction.Rename(id, " Leg day "))
        assertEquals("Leg day", plans.plan(id).name)

        viewModel.onAction(PlanListAction.Delete(id))
        assertTrue(plans.plans.isEmpty())
    }
}
