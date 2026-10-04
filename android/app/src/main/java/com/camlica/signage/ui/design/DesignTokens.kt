// GENERATED — do not edit by hand. Source: shared/design-tokens.json
// Regenerate: node scripts/gen-design-tokens.mjs
package com.camlica.signage.ui.design

/** Same values as panel lib/design-tokens.ts (single source: shared/design-tokens.json). */
internal object DesignTokens {
    val presets: List<ThemePreset> = listOf(
        preset("midnight", "dark", "#0e0e16", "#1a1a26", "#ffffff10", "#ffffff1a", "#ffffff", "#9aa0aa", "#6366f1"),
        preset("navy", "dark", "#0b1020", "#131c36", "#ffffff0f", "#ffffff1a", "#f8fafc", "#8899aa", "#38bdf8"),
        preset("forest", "dark", "#0a1712", "#12291f", "#ffffff0f", "#ffffff1a", "#f0fdf4", "#86a898", "#22c55e"),
        preset("wine", "dark", "#1a0b12", "#2a1220", "#ffffff0f", "#ffffff1a", "#fff1f2", "#b08a98", "#f43f5e"),
        preset("carbon", "dark", "#000000", "#111111", "#ffffff12", "#ffffff1f", "#ffffff", "#a1a1aa", "#f59e0b"),
        preset("paper", "light", "#f7f8fa", "#eceef2", "#ffffff", "#f3f4f6", "#18181b", "#71717a", "#4f46e5"),
        preset("sand", "light", "#faf6ef", "#f1e9db", "#ffffff", "#f7f1e6", "#292524", "#8a7f72", "#d97706"),
        preset("sky", "light", "#f0f7ff", "#dcebfb", "#ffffff", "#eef5fd", "#0f172a", "#64748b", "#0284c7"),
        preset("mint", "light", "#f0fdf6", "#dcf5e8", "#ffffff", "#ecfbf3", "#052e1a", "#5f7d6e", "#059669"),
    )

    val orderBoard: Map<String, StyleSpec> = mapOf(
        "title" to spec("roboto", 56f, 700, "text", "start"),
        "clock" to spec("roboto", 36f, 500, "muted", "end"),
        "columnHeader" to spec("roboto", 34f, 600, "#ffffff", "start"),
        "orderCode" to spec("mono", 88f, 700, "text", "start"),
        "orderLabel" to spec("roboto", 28f, 400, "muted", "start"),
    )

    val queueNumber: Map<String, StyleSpec> = mapOf(
        "heading" to spec("roboto", 56f, 500, "muted", "center"),
        "number" to spec("mono", 300f, 700, "text", "center"),
        "currentName" to spec("roboto", 64f, 600, "text", "center"),
        "subtitle" to spec("roboto", 44f, 400, "muted", "center"),
        "queueTitle" to spec("roboto", 40f, 700, "muted", "start"),
        "queueNumber" to spec("mono", 72f, 700, "accent", "start"),
        "queueName" to spec("roboto", 36f, 400, "muted", "start"),
    )

    val blockDefaults: StyleSpec = spec("roboto", 48f, 400, "text", "start")
}
