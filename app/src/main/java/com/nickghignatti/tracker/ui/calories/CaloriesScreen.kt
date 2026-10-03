@file:OptIn(ExperimentalMaterial3Api::class)

package com.nickghignatti.tracker.ui.calories

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.components.ComingSoon

/** Placeholder until calorie tracking is built. */
@Composable
fun CaloriesScreen() {
    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.calories_title)) }) }) { padding ->
        ComingSoon(R.drawable.ic_calories, stringResource(R.string.calories_coming_soon), Modifier.padding(padding))
    }
}
