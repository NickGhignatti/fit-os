package com.nickghignatti.tracker.ui.profile

import com.nickghignatti.tracker.MainDispatcherRule
import com.nickghignatti.tracker.domain.fake.FakeProfileRepository
import com.nickghignatti.tracker.domain.model.GoalPace
import com.nickghignatti.tracker.domain.model.Profile
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileEditViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val profiles = FakeProfileRepository()

    @Test
    fun `edits stay in the form until saved, then the name is trimmed`() = runTest {
        profiles.saveProfile(Profile(name = "Nick"))
        val vm = ProfileEditViewModel(profiles)
        assertEquals("Nick", vm.uiState.value.profile?.name)

        vm.update { it.copy(name = " Nicola ", heightCm = 180.0, pace = GoalPace.LOSE) }
        assertEquals(Profile(name = "Nick"), profiles.profile)

        vm.save()

        vm.saved.first()
        assertEquals(Profile(name = "Nicola", heightCm = 180.0, pace = GoalPace.LOSE), profiles.profile)
    }
}
