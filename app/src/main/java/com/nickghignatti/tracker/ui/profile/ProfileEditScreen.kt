@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.theme.ButtonKind
import com.nickghignatti.tracker.ui.components.SegmentedSwitcher
import com.nickghignatti.tracker.ui.components.TrackerButton
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.components.TrackerBackButton
import com.nickghignatti.tracker.domain.model.ActivityLevel
import com.nickghignatti.tracker.domain.model.GoalPace
import com.nickghignatti.tracker.domain.model.Profile
import com.nickghignatti.tracker.domain.model.Sex
import com.nickghignatti.tracker.ui.components.DatePickerModal
import com.nickghignatti.tracker.ui.components.NumberField
import com.nickghignatti.tracker.ui.components.SentenceTextField
import com.nickghignatti.tracker.ui.format.formatWeight
import com.nickghignatti.tracker.ui.format.formatted
import com.nickghignatti.tracker.ui.format.parseWeight
import java.time.LocalDate
import java.time.format.FormatStyle

private val HEIGHT_RANGE_CM = 100.0..250.0
private val CUSTOM_KCAL_RANGE = 800.0..6_000.0
private val DEFAULT_BIRTH_DATE: LocalDate = LocalDate.of(1995, 1, 1)

@Composable
fun ProfileEditScreen(onDone: () -> Unit, viewModel: ProfileEditViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) { viewModel.saved.collect { onDone() } }
    val profile = state.profile ?: return
    ProfileEditScreen(profile, onChange = viewModel::update, onSave = viewModel::save, onBack = onDone)
}

@Composable
internal fun ProfileEditScreen(
    profile: Profile,
    onChange: ((Profile) -> Profile) -> Unit,
    onSave: () -> Unit,
    onBack: () -> Unit,
) {
    // Number fields keep the raw text, so a half-typed value is not lost; the profile gets the parsed value.
    var height by rememberSaveable { mutableStateOf(profile.heightCm?.let(::formatWeight).orEmpty()) }
    var customKcal by rememberSaveable { mutableStateOf(profile.customKcal?.let { it.toInt().toString() }.orEmpty()) }
    var pickingBirthDate by rememberSaveable { mutableStateOf(false) }

    val heightValue = parseWeight(height)?.takeIf { it in HEIGHT_RANGE_CM }
    val heightValid = height.isBlank() || heightValue != null
    val kcalValue = parseWeight(customKcal)?.takeIf { it in CUSTOM_KCAL_RANGE }
    val kcalValid = customKcal.isBlank() || kcalValue != null

    Scaffold(
        topBar = {
            TrackerTopBar(
                title = stringResource(R.string.profile_edit_title),
                navigation = { TrackerBackButton(onBack) },
                actions = {
                    TrackerButton(
                        text = stringResource(R.string.action_save),
                        onClick = onSave,
                        enabled = heightValid && kcalValid,
                        compact = true,
                    )
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SentenceTextField(
                profile.name, { name -> onChange { it.copy(name = name) } },
                stringResource(R.string.profile_name_optional), Modifier.fillMaxWidth(),
            )

            FieldTitle(stringResource(R.string.profile_sex))
            SegmentedSwitcher(
                options = Sex.entries,
                selected = profile.sex,
                onSelect = { sex -> onChange { it.copy(sex = sex) } },
                label = { stringResource(it.label()) },
            )

            FieldTitle(stringResource(R.string.profile_birth_date))
            TrackerButton(
                text = profile.birthDate?.formatted(FormatStyle.LONG) ?: stringResource(R.string.profile_choose_date),
                onClick = { pickingBirthDate = true },
                kind = ButtonKind.Secondary,
                compact = true,
            )

            NumberField(
                height,
                { text ->
                    height = text
                    onChange { it.copy(heightCm = parseWeight(text)?.takeIf { cm -> cm in HEIGHT_RANGE_CM }) }
                },
                stringResource(R.string.profile_height_cm), Modifier.fillMaxWidth(),
                decimal = true, isError = !heightValid,
            )

            FieldTitle(stringResource(R.string.profile_activity))
            Column(Modifier.selectableGroup()) {
                ActivityLevel.entries.forEach { level ->
                    Choice(
                        title = stringResource(level.label()),
                        description = stringResource(level.description()),
                        selected = profile.activity == level,
                        onSelect = { onChange { it.copy(activity = level) } },
                    )
                }
            }

            FieldTitle(stringResource(R.string.profile_goal))
            Column(Modifier.selectableGroup()) {
                GoalPace.entries.forEach { pace ->
                    Choice(
                        title = stringResource(pace.label()),
                        description = null,
                        selected = profile.pace == pace,
                        onSelect = { onChange { it.copy(pace = pace) } },
                    )
                }
            }

            FieldTitle(stringResource(R.string.profile_custom_kcal_title))
            NumberField(
                customKcal,
                { text ->
                    customKcal = text
                    onChange { it.copy(customKcal = parseWeight(text)?.takeIf { kcal -> kcal in CUSTOM_KCAL_RANGE }) }
                },
                stringResource(R.string.profile_custom_kcal), Modifier.fillMaxWidth(),
                isError = !kcalValid,
            )
            Text(
                stringResource(R.string.profile_custom_kcal_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    if (pickingBirthDate) {
        DatePickerModal(
            initial = profile.birthDate ?: DEFAULT_BIRTH_DATE,
            onPick = { date -> onChange { it.copy(birthDate = date) }; pickingBirthDate = false },
            onDismiss = { pickingBirthDate = false },
        )
    }
}

@Composable
private fun FieldTitle(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 4.dp))
}

@Composable
private fun Choice(title: String, description: String?, selected: Boolean, onSelect: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onSelect),
    ) {
        RadioButton(selected = selected, onClick = null, modifier = Modifier.padding(end = 12.dp))
        Column {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            description?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
