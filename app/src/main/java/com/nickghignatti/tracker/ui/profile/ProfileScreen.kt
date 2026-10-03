@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.calendar.CalendarSection
import com.nickghignatti.tracker.ui.calendar.CalendarViewModel
import com.nickghignatti.tracker.ui.components.SectionHeader
import java.time.LocalDate

/** The personal page: a placeholder for profile details, and the training calendar. */
@Composable
fun ProfileScreen(
    onOpenDay: (LocalDate) -> Unit,
    calendarViewModel: CalendarViewModel = hiltViewModel(),
) {
    val calendar by calendarViewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.profile_title)) }) }) { padding ->
        Column(
            Modifier
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            OutlinedCard(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        painterResource(R.drawable.ic_person),
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(40.dp),
                    )
                    Text(stringResource(R.string.profile_coming_soon), style = MaterialTheme.typography.bodyLarge)
                }
            }
            SectionHeader(
                stringResource(R.string.profile_section_calendar),
                R.drawable.ic_calendar,
                Modifier.padding(top = 16.dp),
            )
            CalendarSection(calendar, calendarViewModel::onAction, onOpenDay)
        }
    }
}
