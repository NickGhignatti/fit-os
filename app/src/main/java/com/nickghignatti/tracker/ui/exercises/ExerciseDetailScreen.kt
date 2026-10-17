@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.exercises

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.theme.Tracker
import com.nickghignatti.tracker.ui.components.TrackerTopBar
import com.nickghignatti.tracker.ui.components.TrackerBackButton
import com.nickghignatti.tracker.domain.model.ExerciseInfo
import com.nickghignatti.tracker.domain.repository.ExerciseCatalogRepository
import com.nickghignatti.tracker.ui.common.stateInWhileSubscribed
import com.nickghignatti.tracker.ui.components.SectionLabel
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flow

/** Null while loading; [isMissing] when the id is not in the catalogue. */
data class ExerciseDetailUiState(val exercise: ExerciseInfo? = null, val isMissing: Boolean = false)

@HiltViewModel(assistedFactory = ExerciseDetailViewModel.Factory::class)
class ExerciseDetailViewModel @AssistedInject constructor(
    @Assisted id: String,
    catalog: ExerciseCatalogRepository,
) : ViewModel() {

    @AssistedFactory
    interface Factory {
        fun create(id: String): ExerciseDetailViewModel
    }

    val uiState: StateFlow<ExerciseDetailUiState> = flow {
        val exercise = catalog.get(id)
        emit(ExerciseDetailUiState(exercise, isMissing = exercise == null))
    }.stateInWhileSubscribed(this, ExerciseDetailUiState())
}

@Composable
fun ExerciseDetailScreen(onBack: () -> Unit, viewModel: ExerciseDetailViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    ExerciseDetailScreen(state, onBack)
}

@Composable
internal fun ExerciseDetailScreen(state: ExerciseDetailUiState, onBack: () -> Unit) {
    val exercise = state.exercise
    Scaffold(
        topBar = {
            TrackerTopBar(title = exercise?.name.orEmpty(), navigation = { TrackerBackButton(onBack) },)
        },
    ) { padding ->
        if (exercise == null) {
            if (state.isMissing) {
                Text(stringResource(R.string.exercises_missing), modifier = Modifier.padding(padding).padding(16.dp))
            }
            return@Scaffold
        }
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Photos(exercise)
            Facts(exercise)
            SectionLabel(stringResource(R.string.exercises_instructions))
            exercise.instructions.forEachIndexed { index, step ->
                Row {
                    Text(
                        "${index + 1}.",
                        style = Tracker.type.tabularCaption,
                        color = Tracker.colors.inkSecondary,
                        modifier = Modifier.width(28.dp),
                    )
                    Text(step, style = MaterialTheme.typography.bodyLarge)
                }
            }
            CatalogAttribution(Modifier.padding(top = 8.dp))
        }
    }
}

/** Start and end position side by side, loaded on demand and cached by Coil. */
@Composable
private fun Photos(exercise: ExerciseInfo) {
    if (exercise.imageUrls.isEmpty()) return
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
        exercise.imageUrls.take(2).forEachIndexed { index, url ->
            AsyncImage(
                model = url,
                contentDescription = stringResource(R.string.exercises_photo, exercise.name, index + 1),
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .weight(1f)
                    .aspectRatio(PHOTO_ASPECT_RATIO)
                    .clip(MaterialTheme.shapes.medium)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
            )
        }
    }
}

@Composable
private fun Facts(exercise: ExerciseInfo) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Fact(R.string.exercises_primary_muscles, exercise.primaryMuscles.map { stringResource(it.label()) })
        Fact(R.string.exercises_secondary_muscles, exercise.secondaryMuscles.map { stringResource(it.label()) })
        Fact(R.string.exercises_equipment, listOfNotNull(exercise.equipment?.let { stringResource(it.label()) }))
        Fact(
            R.string.exercises_type,
            listOf(stringResource(exercise.category.label()), stringResource(exercise.level.label())),
        )
    }
}

@Composable
private fun Fact(label: Int, values: List<String>) {
    if (values.isEmpty()) return
    Row(Modifier.fillMaxWidth()) {
        Text(
            stringResource(label),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(140.dp),
        )
        Text(values.joinToString(", "), style = MaterialTheme.typography.bodyMedium)
    }
}

private const val PHOTO_ASPECT_RATIO = 0.8f
