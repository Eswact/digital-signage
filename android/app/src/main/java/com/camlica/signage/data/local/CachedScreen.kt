package com.camlica.signage.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Son gösterilen ekran (tek satır, id=0). Offline'da bunu göstermek için. */
@Entity(tableName = "cached_screen")
data class CachedScreen(
    @PrimaryKey val id: Int = 0,
    val screenId: String,
    val template: String,
    val orientation: String,
    val dataJson: String,
    val updatedAt: String?,
)
