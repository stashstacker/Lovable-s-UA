# Changelog

All notable changes to this project will be documented in this file.

## [19.0.0] - 2024-12-03

### Feat
- **Implemented Advanced Procedural World Engine & Map Editor.**
  - **Architectural Overhaul:** Replaced the previous map generation system with a new, high-performance, two-phase engine running in Web Workers to create more realistic and organic world maps.
  - **New "Map Editor" Mode:** Added a dedicated Map Editor accessible from the home screen. This tool allows for the visualization and testing of the new world generation pipeline, including animating the territory formation process.
  - **Phase 1: Skeleton Generation:** Created a `skeleton.worker` that generates a non-uniform point cloud using Perlin noise for density, then computes the Delaunay triangulation and Voronoi diagram. It also identifies and flags border cells, which are used to create natural coastlines.
  - **Phase 2: Muscles Generation:** Created a `muscles.worker` that takes the skeleton and performs several steps:
    1.  **Terrain Carving:** Generates a unique landmass by treating border cells and low-elevation noise cells as "water," creating natural island shapes.
    2.  **Territory Clustering:** Uses a K-Means clustering algorithm on the land cells to form Districts, and then clusters those Districts into Wards.
    3.  **Geometry Stitching:** Calculates and stitches the final SVG path data for all District and Ward borders.
    4.  **Enrichment:** Adds strategic layers like major supply lines (based on Ward triangulation) and points of interest.
  - **Code Cleanup:** Removed all obsolete map generation services (`proceduralMapGenerator`, `voronoiMapGenerator`, `mapGenerationService`, etc.) and related components, consolidating the logic into the new, more powerful engine.

## [18.0.0] - 2024-12-02

### Feat
- **Implemented Procedural Map Generation Engine (Phase 1).**
  - Replaced the static SVG map system with a new, high-performance procedural generation engine that runs in a Web Worker.
  - The engine now generates a "scaffolding" of 12,000 Voronoi cells and uses a k-means clustering algorithm to group them into unique, organic-looking Wards and Districts, as described in the engine specification.
  - This creates a unique, highly detailed, and aesthetically pleasing city map for every new game, dramatically increasing replayability and visual fidelity.

## [17.0.0] - 2024-12-01

### Feat
- **Implemented Economic Logistics & Supply Chains (Phase 2).**
  - **New Asset & Commodity:** Introduced a new "Warehouse" asset for storing goods and a "Moonshine" commodity. The "Hidden Distillery" HQ upgrade now produces Moonshine instead of passive cash.
  - **Supply Chain Mechanics:** Players can now build and upgrade Warehouses in their districts. Moonshine stored in these warehouses is sold automatically over time, generating income, with bonuses for Entertainment districts and higher-level warehouses.
  - **Transport Operations:** A new "Transport Operation" allows players to move Moonshine from their HQ to district warehouses. The crew's `Logistics` skill determines the transport speed.
  - **Live Supply Lines:** The main city map now features a static HQ icon and visualizes active transport operations as animated lines traveling from the HQ to the target district, providing a clear overview of logistical activities.

## [16.0.0] - 2024-11-30

### Changed
- **Major Architectural Refactor & Optimization:**
  - Refactored the `operationGenerator` service to significantly reduce token usage. The service now requests creative mission *templates* from the AI based on player tier, and the final difficulty, reward, and heat values are calculated and scaled by the local game engine in `App.tsx`. This gives finer control over game balance and reduces prompt complexity.
  - Optimized the "Genesis" `scenarioGenerator` by removing the AI's responsibility to calculate a `hiringFee` for recruits. This is now calculated programmatically during game initialization, ensuring a more consistent and balanced economy while simplifying the AI's task.

### Added
- **"Living City" Phase 1-4 Complete:**
  - **Full "Genesis" Initialization:** The advanced game setup screen is now fully functional, passing all player-configured options to the `scenarioGenerator` to create a unique world state, including procedural map geometry and a dynamic background image.
  - **Active Landmarks:** Landmark effects are now fully active, providing passive global bonuses (e.g., income boosts, heat reduction, recruit skill boosts) based on player-controlled districts.
  - **Ward Control Bonuses:** The game now recognizes when a player controls all districts in a Ward, applying powerful thematic bonuses and notifying the player of these strategic shifts.
  - **Rival Conquests:** Rival factions successfully taking over a district will now correctly update the map and cancel any pending player operations in that territory.
  - **Crew Trait System:** Crew members can now gain positive (`Survivor`) or negative (`Shaken`) traits from their experiences on operations, which are displayed on their cards in the Gang View.
  - **Refined Crew Assignments:** The "Assign Task" UI now clearly distinguishes between "Managing" a player-controlled district and "Influencing" a neutral one.
  - **Dynamic Map UI:** The diegetic map gauges are now connected to live game data, and the procedural SVG map is fully interactive with enhanced hover effects and dynamic, more legible district labels.

### Fixed
- **Token Count Display:** Fixed a potential runtime error in the `TokenCountDisplay` component by adding null-safe checks, preventing crashes if the Gemini API response is missing usage metadata.

## [15.0.0] - 2024-11-29

### Docs
- **Synchronized Project Blueprint:** Completely overhauled `MASTERPROMPT.json` to be a precise, up-to-date reflection of the project's current, advanced state. This includes accurately documenting the procedural SVG map system (D3-Delaunay/Polygon), the full "Genesis" prompt with its complex `ScenarioOptions` from the advanced setup screen, and all current gameplay mechanics like Ward Control Bonuses and adjacent-only rival AI. The `MASTERPROMPT.md` file has been updated to be a simple pointer to this new authoritative document.

## [14.0.0] - 2024-11-28

### Docs
- Converted the project's master prompt from Markdown to a structured JSON format (`MASTERPROMPT.json`) to serve as a machine-readable single source of truth. The original markdown file has been updated to point to the new authoritative document.

## [12.0.0] - 2024-11-27

### feat(UI)
- Added a new visual indicator on the map for player influence in neutral districts. A semi-transparent, striped overlay now appears, with its opacity reflecting the current influence level, providing clear progress feedback toward a peaceful takeover.

### fix(Gameplay)
- Corrected the spawning logic for random map activities. "Influence" rewards will now only appear over neutral districts where they can be applied, preventing wasted reward opportunities. Cash rewards continue to appear on player and neutral territories.

## [11.0.0] - 2024-11-26

### refactor(AI)
- Improved rival faction AI by restricting attacks and expansions to adjacent territories only, making their behavior more strategic and believable. The AI now uses map connection data to determine valid targets.

### feat
- Enhanced MapView with dynamic hover effects for wards and new visual indicators. Hovering a district now highlights its parent ward. Districts with player influence or under rival attack are now clearly marked with new overlays and animations.

## [10.0.0] - 2024-11-25

### Feat
- **Ward Control Bonuses:** Implemented a new strategic bonus system. The game engine now checks if the player controls all districts within a city Ward. If so, a powerful, thematic bonus (e.g., +15% income, reduced heat generation) is automatically applied, making territorial control a core strategic goal.

## [9.0.0] - 2024-11-24

### Feat
- **Contextual Map Actions:** The `DistrictDetailModal` is now context-aware. When a player-controlled district is under attack, the modal displays the threat and provides a "Launch Defense" button, allowing for a direct response from the map view.
- **Random Map Rewards:** The city map is now more dynamic with new "Map Activities." Clickable reward icons for cash or influence will now randomly appear over districts, rewarding players for active map observation.
- **Bribe Cooldown:** The "Bribe the Cops" HQ action now has a 7-day cooldown, preventing spamming and making it a more strategic decision. The UI in the `HqView` clearly displays the remaining cooldown time.

### Fix
- **Duplicate Defense Notifications:** Corrected an issue in the game loop where multiple rival attacks on a single district would generate duplicate defense operations and notifications. The system now correctly creates only one defense opportunity per district under siege.
- **Notification System:** Reworked the `NotificationLog` component to ensure notifications reliably auto-dismiss after 5 seconds. A "Clear All" button was also added to improve UI management.

## [8.0.0] - 2024-11-23

### Feat
- **Completed Procedural Map Integration (Phase 3).**
  - **Dynamic Background Generation:** The game now generates a unique, thematic "city blueprint" background image using the Gemini Image Preview model at the start of each new game. This image is stored in the game state and rendered as the map's background, ensuring every playthrough has a distinct visual identity.
  - **MapView Refactor:** The `MapView` component has been fully refactored to be a pure rendering component. It now receives all procedural geometric data (district/ward paths, connection lines) from the `gameState` via props.
  - **Interactive Connections:** The map now renders curved, interactive connection lines between adjacent districts. Hovering over a district highlights both the district itself and its connections to neighbors, providing superior strategic feedback as envisioned in the technical prototype.

## [7.0.0] - 2024-11-22

### Changed
- **Integrated Procedural Map Generation into Game Lifecycle (Phase 2).**
  - Updated the `handleInitializeGame` function in `App.tsx` to call the new `generateMapData` service.
  - Upon starting a new game, the application now generates a unique Voronoi layout for the city, enriching the game state with the necessary SVG path data for each district and ward.
  - The adjacency `connections` data is now also generated and stored in the `gameState`, preparing the application for the final visual rendering phase of the interactive map.

## [6.0.0] - 2024-11-21

### Feat
- **Implemented Procedural Voronoi Map Generation (Phase 1).**
  - Created a new `voronoiMapGenerator` service that utilizes the D3-Delaunay library to generate a unique, truly procedural map layout for each new game.
  - This service creates organic, curved borders between districts for a more hand-drawn, thematic feel.
  - The old `proceduralMapGenerator` service, which used hardcoded SVG paths, has been removed.
  - The core `GameState` has been updated to store `mapConnections` data, which will be used to draw interactive adjacency lines in the next phase.

## [5.0.0] - 2024-11-20

### Feat
- **Completed "Master Planner's Blueprint" (Phase 3): Full Gameplay Integration.**
  - **Ward Control Bonuses:** Implemented a strategic bonus system. The game engine now checks if the player controls all districts within a city Ward. If so, a powerful, thematic bonus (e.g., +15% income, reduced heat generation) is automatically applied, making territorial control a core strategic goal.
  - **Ward Info Panel:** The map view now features a dynamic Ward Information Panel. Clicking on a ward displays detailed strategic information, including the dominant controlling faction, a list of its districts, and a description of the control bonus, providing players with at-a-glance strategic context.
  - **Functional Diegetic Gauges:** The gauges in the map's thematic frame are now fully functional, providing a live, immersive visualization of global `heat` and police `investigationProgress`.
  - **Dynamic Notifications:** The main game loop now intelligently detects when a Ward bonus is gained or lost and immediately informs the player via the notification system, highlighting these significant strategic shifts.

## [4.0.0] - 2024-11-19

### Changed
- **Major Visual & UX Overhaul: Implemented "Master Planner's Blueprint" (Phase 2).**
  - **New SVG Map:** Completely rebuilt the `MapView` component to feature a single, large, interactive SVG map, replacing the previous CSS grid layout. The new map is housed in a thematic "diegetic" frame with riveted metal styling and placeholder gauges for future stats.
  - **Hierarchical Rendering:** The map now visually renders the game's hierarchical geography. Wards are drawn as large, outlined territories, and each District within a ward is an individual, interactive SVG path.
  - **Dynamic & Interactive:** District paths are color-coded based on the controlling faction. Hovering over districts provides immediate visual feedback by highlighting the district and its parent ward. Clicking a district opens its detail modal as before.
  - **Procedural Map Service:** Created a new `proceduralMapGenerator` service that simulates the output of a complex Voronoi algorithm. It provides high-quality, pre-defined SVG path data, which is then mapped to the game's current ward and district state, ensuring a unique and visually compelling city layout for every game.
  - **Updated Data Types:** The `Ward` and `District` types were enhanced to include optional `svgPath` and `centroid` properties to support the new rendering engine.

## [3.0.0] - 2024-11-18

### Changed
- **Major Architectural Refactor: "Master Planner's Blueprint" Foundation.**
  - Reworked the core data model to support a hierarchical city map. The game state now uses a `wards: Ward[]` structure, where each Ward contains its own array of Districts.
  - Updated the "Genesis" world generation prompt to create thematic Wards and populate them with Districts, providing a richer, more organized city structure.
  - Refactored all game logic services (`automationService`, `rivalFactionService`, etc.) and the main application component (`App.tsx`) to be fully compatible with the new hierarchical data structure, ensuring all gameplay mechanics function correctly. This lays the essential groundwork for future visual and strategic map enhancements.

## [2.8.1] - 2024-11-17

### Fix
- **Game Loop Execution:** Corrected a critical typo in a service import path within the main application component. This fix resolves a runtime error that was preventing the core game loop and all associated automation services (passive income, rival turns, etc.) from executing, restoring the game's primary functionality.

## [2.8.0] - 2024-11-16

### Feat
- **Event Chronicle & Notification System:** Implemented a new persistent "Event Chronicle" accessible via a bell icon in the header, allowing players to review a detailed history of all major game events. Refined the pop-up notification system to be less intrusive by shortening its display time to 5 seconds and using a cleaner fade-out animation.

## [2.7.3] - 2024-11-15

### Feat
- **Dynamic Catch-Up Economics:** Implemented a "catch-up" system to ensure game balance. If a rival faction's total economic strength (cash + territory value) falls significantly below the player's (less than 40%), they will receive a cash injection from a "shadowy patron." This prevents rival factions from being permanently crippled by early losses and maintains a persistent challenge throughout the game.

## [2.7.2] - 2024-11-14

### Feat
- **Strategic Rival Coordination:** Implemented a new rule for rival AI to prevent "pile-on" attacks. A rival faction can no longer launch an operation against a district that is already being targeted by another faction, making territorial conflicts more strategic and less chaotic.

## [2.7.1] - 2024-11-13

### Fix
- **"Recently Contested" Status:** Fixed a critical bug where the "Recently Contested" status (and its associated takeover cooldown) was not being applied to a district after a successful player defense. Now, repelling a rival attack correctly fortifies the district, preventing immediate follow-up takeover attempts from any faction.

## [2.7.0] - 2024-11-12

### Feat
- **Advanced Game Setup Screen:** Completely overhauled the home screen to feature a sophisticated, multi-panel UI inspired by grand strategy games. Players can now use granular sliders to control world generation parameters, including the number of districts and rival factions, economic volatility, rival aggression, and more. Skirmish mode now includes "Quick Start" presets (Casual, Balanced, Hardcore) that adjust these advanced settings automatically. This provides an immensely deeper and more replayable game setup experience.

## [2.6.0] - 2024-11-11

### Feat
- **Overhauled Game Setup:** Reworked the home screen to include a full game setup menu. Players can now choose between a narrative-driven 'Campaign' mode and a sandbox 'Skirmish' mode. Added 'Easy', 'Normal', and 'Hard' difficulty settings which affect starting conditions. Introduced selectable 'Narrative Templates' (e.g., 'Classic Noir-Steampunk', 'Cyberpunk Yakuza') to generate different thematic worlds. This provides a more robust and replayable starting experience.

## [2.5.0] - 2024-11-10

### Refactor
- **UI:** Replaced the placeholder background image with a more thematic, high-quality "noir street" image to enhance the game's atmosphere. Centralized the image URL into a constant for improved maintainability.

## [2.4.0] - 2024-11-09

### Feat
- **Enhanced Narrative Engine:** Implemented a robust trigger system for narrative progression. The story now advances based on a variety of player achievements, including reaching a specific empire tier, accumulating a certain amount of total earnings, or controlling a set number of districts. This makes the game's story feel more dynamic and responsive to the player's strategic decisions.

## [2.3.0] - 2024-11-08

### Feat
- **Added Finance View:** Implemented a new "Finance" view, accessible from the main navigation. This screen provides a detailed financial ledger, including breakdowns of recent income and expenses.
- **Transaction Logging System:** Integrated a new system to log every financial transaction (income from operations, passive income, expenses for bribes, upgrades, etc.).
- **Cash Flow Charting:** The new Finance view includes a historical line chart that visualizes the player's cash balance over the last 7 game days, offering a strategic overview of their economic performance.

## [2.2.0] - 2024-11-07

### Feat
- **Implemented Genesis Engine (Phase 3).**
  - **New Lieutenants System:** Replaced the "Training Ground" with a new "Lieutenants" view. Instead of a simple purchase, players must now pay a significant cost to "Pursue" a lieutenant, which generates a unique, high-difficulty recruitment operation. Successful completion adds the powerful lieutenant to the player's crew.
  - **Dynamic Narrative System:** Implemented a narrative trigger system within the main game loop. The game now checks the player's progress (e.g., reaching a new empire tier) against conditions set by the AI-generated story. When a condition is met, the story advances to the next act, updating the main objective and creating a sense of progression.
  - **Economic Climate Integration:** The `EconomicClimate` generated at the start of the game is now active. A new UI element displays the current economic conditions, and the `volatility` of the economy now applies small, random fluctuations to the player's hourly income, making the world more dynamic.

## [2.1.0] - 2024-11-06

### Feat
- **Implemented Genesis Engine (Phase 2).**
  - **Intelligent Rival AI:** Overhauled the `rivalFactionService` to use a dynamic, probabilistic decision-making model. Rival AI now makes strategic choices based on its unique, generated `aiProfile` (expansionism, covertOps, etc.) and targets districts based on their `strategicValue`, leading to more varied and intelligent opponent behavior.
  - **Enhanced Map Information:** The Map View now displays the `strategicValue` of each district, providing the player with the same critical intelligence the rival AI uses for its decision-making.
  - **Deeper Recruitment System:** The AI-powered world generation now includes a `rarity` (common, uncommon, rare) and a short `backstoryHook` for every potential recruit. These details are now visible in the Recruitment view, adding flavor and personality to the hiring process.

## [2.0.0] - 2024-11-05

### Changed
- **Major Architectural Overhaul: Implemented Genesis Engine (Phase 1).**
  - Replaced the multiple on-demand API calls at startup with a single, comprehensive "Genesis" call to `scenarioGenerator.ts`. This function now generates the entire world state in one pass, including a deep narrative structure, a detailed city map, complex rival factions, full district recruitment pools, unique lieutenants, and an economic climate.
  - Overhauled all core data structures in `types.ts` to align with the rich new schema provided by the Genesis prompt.
  - Refactored the game's initialization logic in `App.tsx` and `HomeScreen.tsx` to correctly parse and load the new, unified world state object.
  - Implemented a crucial compatibility layer that transforms the new "Lieutenants" into the game's existing "Legendary Recruitment Mission" format, ensuring the application remains fully functional post-overhaul.
  - Marked obsolete, single-purpose generator files (`legendaryMissionGenerator.ts`, `recruitPoolGenerator.ts`) for deletion to enforce the new single-source-of-truth architecture.

## [1.9.0] - 2024-11-05

### Docs
- **Formalized Project Blueprint:** Updated the `FUTURE_FEATURES.md` roadmap by transcribing the detailed systems from the advanced "Genesis Prompt." This codifies the project's long-term architectural vision for a dynamic narrative, advanced faction AI, elite lieutenants, and a deep economic simulation, ensuring strategic alignment before the major implementation phase.

## [1.8.0] - 2024-11-04

### Feat
- **Atmospheric Background:** Replaced the generic placeholder background image on the home screen and main application view with a more thematic and visible "noir city street" image, enhancing the game's atmosphere.

### Docs
- **Refined Future Roadmap:** Integrated detailed, user-provided feature specifications into `FUTURE_FEATURES.md`. The roadmap now includes more concrete plans for a dedicated Finance View, crew upkeep/salary costs, a research/technology tree, illicit goods management, and an inter-faction diplomacy system.

## [1.7.0] - 2024-11-03

### Feat
- **Gang Member Rating System:** Implemented a "Rating" system for all gang members and potential recruits, calculated as the sum of their total skill points. This provides a clear, at-a-glance measure of a character's overall quality. The rating is now visible in the Gang and Recruitment views, and the crew can be sorted by this new metric.
- **Influential Scouting Mechanic:** The "Scout for Talent" operation is now more strategic. The `influence` skill of the assigned scout now directly impacts the quality of recruits they are likely to find. Higher-influence scouts have a better chance of discovering the most skilled individuals from a district's hidden recruitment pool, adding more depth to crew management and assignments.

## [1.6.0] - 2024-11-02

### Docs
- **Updated Contribution Guidelines:** Reframed the `CONTRIBUTING_GUIDELINES.md` to establish the AI assistant as a core development partner rather than a simple directive-following tool. The new guidelines emphasize proactive analysis, strategic feedback, and independent co-development to better align with the project's ambitious goals.

## [1.5.0] - 2024-11-01

### Changed
- **Expanded Project Vision:** Conducted an in-depth analysis of a master development plan and significantly expanded the `FUTURE_FEATURES.md` roadmap. This update codifies the long-term vision for the project, introducing major new systems such as a Dynamic Narrative Engine, Inter-Faction Diplomacy, a deep Economic Simulation with supply chains, and Thematic World Templates for enhanced replayability.

## [1.4.0] - 2024-10-31

### Added
- **Future Features Roadmap:** Created `FUTURE_FEATURES.md` to track and outline potential new gameplay systems and enhancements, such as Safehouses, a Technology Tree, and deeper character mechanics. This provides a clear vision for the project's evolution.

## [1.3.0] - 2024-10-30

### Added
- **District Landmarks:** Added unique, strategic landmarks to certain city districts (e.g., The Grand Casino, Media Tower). Controlling these districts now provides powerful, passive global bonuses to the controlling faction, making territorial control more meaningful. These are now visible on the Map View and in the District Detail modal.
- **Character Traits:** Gang members can now acquire persistent positive or negative traits from their experiences. Successfully defending a district can award a positive trait like "Survivor," while barely succeeding at a risky operation can result in a negative trait like "Shaken." Traits are visible on the Gang View.
- **Police Investigation System:** Implemented a new "Investigation Progress" meter that slowly increases when player heat is high. If the meter reaches 100%, a devastating "RICO Raid" event is triggered, freezing player assets and arresting key members. This transforms high heat from a simple debuff into a tangible, long-term threat. The meter is visible in the main header, and bribing the police now helps to reduce it.

## [1.2.0] - 2024-10-29

### Changed
- **Phase 3 Complete: Cleanup & Consolidation.**
  - Finalized the transition to the "Upfront World-Building" architecture.
  - Removed all exports and application logic related to the on-demand `recruitGenerator` service, making it fully obsolete.
  - Confirmed that all obsolete constants (`INITIAL_GANG_MEMBERS`, etc.) have been removed from the codebase.
  - The new, clean architecture is now fully realized and documented.

## [1.1.0] - 2024-10-28

### Changed
- **Phase 2 Complete: Refactored Core Mechanics.**
  - The core game mechanics have been refactored to use the pre-generated world content.
  - **Recruitment as "Reveal":** The "Scout for Talent" operation now functions as a "reveal" mechanic, drawing a random selection of recruits from the deep, hidden pool generated during game start. On-demand AI calls for recruitment have been completely removed.
  - **Dynamic Training Ground:** The Training Ground view now dynamically displays the unique, AI-generated legendary missions from the game state, making it a replayable feature with unique content each game.
- **Architectural Cleanup:** Completed the refactor to a modular service architecture. All references to obsolete monolithic service files (`geminiService.ts`, etc.) have been removed. The now-unused `services/gemini/recruitGenerator.ts` is also removed from the project logic.

## [1.0.0] - 2024-10-27

### Added
- Created this CHANGELOG.md file.

### Changed
- **Major Architectural Overhaul: Upfront World-Building.**
  - The initial "Ascend Into The Underworld" action now triggers a single, comprehensive call to the Gemini API to generate a unique world state.
  - **Dynamic Rival Factions:** The AI now generates 2-4 unique rival factions with distinct names and strategies for each playthrough.
  - **Deep Recruitment Pools:** The AI now pre-populates every city district with a hidden pool of 16-24 unique, thematic potential recruits.
  - **Legendary Recruits:** The AI generates 2-4 unique, high-stakes "legendary" recruitment missions.
- Refactored the service architecture to cleanly separate concerns. All self-contained, rule-based logic is in `services/localAutomations/`, and all external AI calls are in `services/gemini/`.
