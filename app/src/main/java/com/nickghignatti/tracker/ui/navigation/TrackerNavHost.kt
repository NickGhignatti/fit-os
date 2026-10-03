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
import com.nickghignatti.tracker.ui.calories.CaloriesScreen
import com.nickghignatti.tracker.ui.day.DayScreen
import com.nickghignatti.tracker.ui.day.DayViewModel
import com.nickghignatti.tracker.ui.diet.DietPlanScreen
import com.nickghignatti.tracker.ui.diet.DietPlanViewModel
import com.nickghignatti.tracker.ui.diet.DietPlansScreen
import com.nickghignatti.tracker.ui.food.FoodSearchScreen
import com.nickghignatti.tracker.ui.food.FoodSearchViewModel
import com.nickghignatti.tracker.ui.food.FoodTarget
import com.nickghignatti.tracker.ui.profile.ProfileScreen
import com.nickghignatti.tracker.ui.today.TodayScreen
import com.nickghignatti.tracker.ui.training.TrainingPlanScreen
import com.nickghignatti.tracker.ui.training.TrainingPlanViewModel
import com.nickghignatti.tracker.ui.training.TrainingPlansScreen
import java.time.LocalDate

/** The bottom bar, left to right, with Home in the middle. */
private enum class TopLevelDestination(
    val route: Any,
    @param:StringRes val label: Int,
    @param:DrawableRes val icon: Int,
) {
    Training(TrainingRoute, R.string.nav_training, R.drawable.ic_fitness),
    Diet(DietRoute, R.string.nav_diet, R.drawable.ic_restaurant),
    Home(TodayRoute, R.string.nav_home, R.drawable.ic_home),
    Calories(CaloriesRoute, R.string.nav_calories, R.drawable.ic_calories),
    Profile(ProfileRoute, R.string.nav_profile, R.drawable.ic_person),
}

private fun NavHostController.openDay(date: LocalDate) = navigate(DayRoute(date))

private fun NavHostController.openTopLevel(destination: TopLevelDestination) =
    navigate(destination.route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }

@Composable
private fun foodSearchViewModel(target: FoodTarget) =
    hiltViewModel<FoodSearchViewModel, FoodSearchViewModel.Factory> { it.create(target) }

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
            composable<TrainingRoute> { TrainingPlansScreen(onOpenPlan = { nav.navigate(TrainingPlanRoute(it)) }) }
            composable<TrainingPlanRoute> { entry ->
                val planId = entry.toRoute<TrainingPlanRoute>().planId
                TrainingPlanScreen(
                    onBack = { nav.popBackStack() },
                    viewModel = hiltViewModel<TrainingPlanViewModel, TrainingPlanViewModel.Factory> { it.create(planId) },
                )
            }
            composable<DietRoute> { DietPlansScreen(onOpenPlan = { nav.navigate(DietPlanRoute(it)) }) }
            composable<DietPlanRoute> { entry ->
                val planId = entry.toRoute<DietPlanRoute>().planId
                DietPlanScreen(
                    onBack = { nav.popBackStack() },
                    onAddFood = { meal -> nav.navigate(DietFoodRoute(meal.id, meal.name)) },
                    viewModel = hiltViewModel<DietPlanViewModel, DietPlanViewModel.Factory> { it.create(planId) },
                )
            }
            composable<TodayRoute> {
                TodayScreen(
                    onOpenDay = nav::openDay,
                    onOpenTraining = { nav.openTopLevel(TopLevelDestination.Training) },
                    onOpenDiet = { nav.openTopLevel(TopLevelDestination.Diet) },
                )
            }
            composable<CaloriesRoute> { CaloriesScreen(onAddFood = { date, meal -> nav.navigate(LogFoodRoute(date, meal)) }) }
            composable<LogFoodRoute> { entry ->
                val route = entry.toRoute<LogFoodRoute>()
                FoodSearchScreen(onDone = { nav.popBackStack() }, viewModel = foodSearchViewModel(FoodTarget.Log(route.date, route.meal)))
            }
            composable<DietFoodRoute> { entry ->
                val route = entry.toRoute<DietFoodRoute>()
                FoodSearchScreen(
                    onDone = { nav.popBackStack() },
                    viewModel = foodSearchViewModel(FoodTarget.DietMeal(route.mealId, route.mealName)),
                )
            }
            composable<ProfileRoute> { ProfileScreen(onOpenDay = nav::openDay) }
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
