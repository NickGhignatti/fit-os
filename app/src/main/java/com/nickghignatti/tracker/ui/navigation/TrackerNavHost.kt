package com.nickghignatti.tracker.ui.navigation

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.nickghignatti.tracker.R
import com.nickghignatti.tracker.ui.calendar.CalendarScreen
import com.nickghignatti.tracker.ui.day.DayScreen
import com.nickghignatti.tracker.ui.day.DayViewModel
import com.nickghignatti.tracker.ui.diet.DietScreen
import com.nickghignatti.tracker.ui.templates.TemplatesScreen
import com.nickghignatti.tracker.ui.today.TodayScreen
import java.time.LocalDate

private enum class TopLevelDestination(
    val route: Any,
    @param:StringRes val label: Int,
    @param:DrawableRes val icon: Int,
) {
    Today(TodayRoute, R.string.nav_today, R.drawable.ic_home),
    Calendar(CalendarRoute, R.string.nav_calendar, R.drawable.ic_calendar),
    Templates(TemplatesRoute, R.string.nav_templates, R.drawable.ic_bookmark),
    Diet(DietRoute, R.string.nav_diet, R.drawable.ic_restaurant),
}

private fun NavHostController.openDay(date: LocalDate) = navigate(DayRoute(date))

private fun NavHostController.openTopLevel(destination: TopLevelDestination) =
    navigate(destination.route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }

@Composable
fun TrackerNavHost() {
    val nav = rememberNavController()
    val backStackEntry by nav.currentBackStackEntryAsState()
    val destination = backStackEntry?.destination
    val showBottomBar = TopLevelDestination.entries.any { destination?.hasRoute(it.route::class) == true }

    // Each screen owns its Scaffold/top bar; this outer one only hosts the bottom bar.
    Scaffold(
        contentWindowInsets = WindowInsets(0),
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    TopLevelDestination.entries.forEach { item ->
                        NavigationBarItem(
                            selected = destination?.hierarchy?.any { it.hasRoute(item.route::class) } == true,
                            onClick = { nav.openTopLevel(item) },
                            icon = { Icon(painterResource(item.icon), contentDescription = null) },
                            label = { Text(stringResource(item.label)) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = TodayRoute,
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            composable<TodayRoute> {
                TodayScreen(
                    onOpenDay = nav::openDay,
                    onOpenDiet = { nav.openTopLevel(TopLevelDestination.Diet) },
                )
            }
            composable<CalendarRoute> { CalendarScreen(onOpenDay = nav::openDay) }
            composable<TemplatesRoute> { TemplatesScreen(onOpenDay = nav::openDay) }
            composable<DietRoute> { DietScreen() }
            composable<DayRoute> { entry ->
                val date = entry.toRoute<DayRoute>().date
                DayScreen(
                    onBack = { nav.popBackStack() },
                    viewModel = hiltViewModel<DayViewModel, DayViewModel.Factory> { it.create(date) },
                )
            }
        }
    }
}
