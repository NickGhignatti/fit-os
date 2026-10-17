package com.nickghignatti.tracker.ui.profile

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeProfileRepository
import com.nickghignatti.tracker.domain.fake.FakeWeightRepository
import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.model.Sex
import com.nickghignatti.tracker.domain.usecase.ObserveDailyTargetsUseCase
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val today = LocalDate.of(2026, 10, 3)
    private val clock = Clock.fixed(today.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC)
    private val profiles = FakeProfileRepository()
    private val weights = FakeWeightRepository()
    // Created lazily so viewModelScope binds to the dispatcher installed by the rule.
    private val viewModel by lazy { ProfileViewModel(clock, profiles, weights, ObserveDailyTargetsUseCase(profiles, weights)) }

    @Test
    fun `an empty profile lists everything the goal still needs`() = runTest {
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }

        assertEquals(MissingInfo.entries, viewModel.uiState.value.missingForGoal)
    }

    @Test
    fun `filling in the profile and logging a weight gives a goal`() = runTest {
        profiles.saveProfile(Profile(sex = Sex.FEMALE, birthDate = LocalDate.of(1990, 1, 1), heightCm = 168.0))
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }
        assertEquals(listOf(MissingInfo.WEIGHT), viewModel.uiState.value.missingForGoal)

        viewModel.onAction(ProfileAction.LogWeight(today, 62.0))

        val state = viewModel.uiState.value
        assertNotNull(state.targets)
        assertTrue(state.missingForGoal.isEmpty())
        assertEquals(36, state.age)
        assertEquals(62.0, state.latestWeight!!.kg, 0.0)
    }

    @Test
    fun `weigh-ins can be deleted`() = runTest {
        weights.logWeight(today, 62.0)

        viewModel.onAction(ProfileAction.DeleteWeight(weights.entries.single().id))

        assertTrue(weights.observeEntries().first().isEmpty())
    }
}
