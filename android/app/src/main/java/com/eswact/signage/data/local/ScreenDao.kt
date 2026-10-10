package com.eswact.signage.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ScreenDao {
    @Query("SELECT * FROM cached_screen WHERE id = 0 LIMIT 1")
    suspend fun get(): CachedScreen?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(screen: CachedScreen)

    @Query("DELETE FROM cached_screen")
    suspend fun clear()
}
