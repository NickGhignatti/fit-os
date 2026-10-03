package com.nickghignatti.tracker.data.local

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

internal val ALL_MIGRATIONS = arrayOf<Migration>(Migration1To2)

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
