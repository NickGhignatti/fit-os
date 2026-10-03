package com.nickghignatti.tracker.data.local

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

internal val ALL_MIGRATIONS = arrayOf<Migration>(Migration1To2, Migration2To3, Migration3To4, Migration4To5)

/**
 * Version 2 replaces templates and the single weekly meal plan with training and diet plans:
 * - every template becomes an inactive daily training plan, keeping its ids;
 * - the weekly meals, if any, become the active weekly diet plan "My diet";
 * - workouts remember the plan they were started from.
 *
 * Room enables foreign keys only after migrating, so dropping and renaming tables cascades nothing.
 */
internal object Migration1To2 : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        migrateTemplates(db)
        db.execSQL(
            "ALTER TABLE `workouts` ADD COLUMN `planId` INTEGER " +
                "REFERENCES `training_plans`(`id`) ON UPDATE NO ACTION ON DELETE SET NULL",
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_workouts_planId` ON `workouts` (`planId`)")
        migrateMeals(db)
    }

    private fun migrateTemplates(db: SupportSQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `training_plans` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`name` TEXT NOT NULL, `recurrence` TEXT NOT NULL, `isActive` INTEGER NOT NULL)",
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `plan_exercises` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`planId` INTEGER NOT NULL, `day` INTEGER NOT NULL, `position` INTEGER NOT NULL, `name` TEXT NOT NULL, " +
                "`notes` TEXT NOT NULL, FOREIGN KEY(`planId`) REFERENCES `training_plans`(`id`) " +
                "ON UPDATE NO ACTION ON DELETE CASCADE )",
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_plan_exercises_planId` ON `plan_exercises` (`planId`)")
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `plan_sets` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`exerciseId` INTEGER NOT NULL, `position` INTEGER NOT NULL, `reps` INTEGER NOT NULL, `weight` REAL, " +
                "FOREIGN KEY(`exerciseId`) REFERENCES `plan_exercises`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE )",
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_plan_sets_exerciseId` ON `plan_sets` (`exerciseId`)")

        db.execSQL("INSERT INTO `training_plans` (`id`, `name`, `recurrence`, `isActive`) SELECT `id`, `name`, 'DAILY', 0 FROM `templates`")
        db.execSQL(
            "INSERT INTO `plan_exercises` (`id`, `planId`, `day`, `position`, `name`, `notes`) " +
                "SELECT `id`, `templateId`, $EVERY_DAY, `position`, `name`, `notes` FROM `template_exercises`",
        )
        db.execSQL(
            "INSERT INTO `plan_sets` (`id`, `exerciseId`, `position`, `reps`, `weight`) " +
                "SELECT `id`, `templateExerciseId`, `position`, `reps`, `weight` FROM `template_sets`",
        )
        db.execSQL("DROP TABLE `template_sets`")
        db.execSQL("DROP TABLE `template_exercises`")
        db.execSQL("DROP TABLE `templates`")
    }

    private fun migrateMeals(db: SupportSQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `diet_plans` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`name` TEXT NOT NULL, `recurrence` TEXT NOT NULL, `isActive` INTEGER NOT NULL)",
        )
        db.execSQL(
            "INSERT INTO `diet_plans` (`name`, `recurrence`, `isActive`) " +
                "SELECT '$MIGRATED_DIET_NAME', 'WEEKLY', 1 WHERE EXISTS (SELECT 1 FROM `meals`)",
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `meals_new` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`planId` INTEGER NOT NULL, `day` INTEGER NOT NULL, `position` INTEGER NOT NULL, `name` TEXT NOT NULL, " +
                "`time` TEXT NOT NULL, FOREIGN KEY(`planId`) REFERENCES `diet_plans`(`id`) " +
                "ON UPDATE NO ACTION ON DELETE CASCADE )",
        )
        // Weekdays were stored as their ISO number, which is also how plan days store them.
        db.execSQL(
            "INSERT INTO `meals_new` (`id`, `planId`, `day`, `position`, `name`, `time`) " +
                "SELECT `id`, (SELECT `id` FROM `diet_plans`), `dayOfWeek`, `position`, `name`, `time` FROM `meals`",
        )
        // Meal ids are kept, so `foods` still points at the right rows once the new table takes the name.
        db.execSQL("DROP TABLE `meals`")
        db.execSQL("ALTER TABLE `meals_new` RENAME TO `meals`")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_meals_planId` ON `meals` (`planId`)")
    }

    private const val EVERY_DAY = 0
    private const val MIGRATED_DIET_NAME = "My diet"
}

/**
 * Version 3 adds calorie tracking: diet foods can link to a known food (all new columns are
 * nullable, so existing foods stay free text), plus the food log, custom foods and favourites.
 */
internal object Migration2To3 : Migration(2, 3) {
    private val LINKED_FOOD_COLUMNS = listOf(
        "grams" to "REAL",
        "linked_foodId" to "TEXT",
        "linked_name" to "TEXT",
        "linked_brand" to "TEXT",
        "linked_kcal" to "REAL",
        "linked_protein" to "REAL",
        "linked_carbs" to "REAL",
        "linked_fat" to "REAL",
        "linked_servingGrams" to "REAL",
    )

    override fun migrate(db: SupportSQLiteDatabase) {
        LINKED_FOOD_COLUMNS.forEach { (column, type) -> db.execSQL("ALTER TABLE `foods` ADD COLUMN `$column` $type") }
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `food_log` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`date` INTEGER NOT NULL, `meal` TEXT NOT NULL, `grams` REAL NOT NULL, `foodId` TEXT NOT NULL, " +
                "`name` TEXT NOT NULL, `brand` TEXT, `kcal` REAL NOT NULL, `protein` REAL NOT NULL, " +
                "`carbs` REAL NOT NULL, `fat` REAL NOT NULL, `servingGrams` REAL)",
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_food_log_date` ON `food_log` (`date`)")
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `custom_foods` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                "`name` TEXT NOT NULL, `brand` TEXT, `kcal` REAL NOT NULL, `protein` REAL NOT NULL, " +
                "`carbs` REAL NOT NULL, `fat` REAL NOT NULL, `servingGrams` REAL)",
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `favorite_foods` (`foodId` TEXT NOT NULL, `name` TEXT NOT NULL, " +
                "`brand` TEXT, `kcal` REAL NOT NULL, `protein` REAL NOT NULL, `carbs` REAL NOT NULL, " +
                "`fat` REAL NOT NULL, `servingGrams` REAL, PRIMARY KEY(`foodId`))",
        )
    }
}

/** Version 4 keeps packaged products the user has seen, so they can be found offline. */
internal object Migration3To4 : Migration(3, 4) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `saved_products` (`foodId` TEXT NOT NULL, `name` TEXT NOT NULL, " +
                "`brand` TEXT, `kcal` REAL NOT NULL, `protein` REAL NOT NULL, `carbs` REAL NOT NULL, " +
                "`fat` REAL NOT NULL, `servingGrams` REAL, PRIMARY KEY(`foodId`))",
        )
    }
}

/** Version 5 lets workout and plan exercises link to the exercise catalogue; existing ones stay free text. */
internal object Migration4To5 : Migration(4, 5) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `exercises` ADD COLUMN `catalogId` TEXT")
        db.execSQL("ALTER TABLE `plan_exercises` ADD COLUMN `catalogId` TEXT")
    }
}
