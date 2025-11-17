# Future Features Roadmap for Underworld Ascendant

This document outlines the major gameplay systems and enhancements planned for future development cycles. Having established a strong foundation with procedural world generation, core empire management, and a dynamic operation system, the project's evolution will focus on deepening player expression, strategic complexity, and narrative immersion.

---

### 1. The Mastermind's Dossier (Deep Character Progression)

**Goal:** To transform the Mastermind from a class choice into a fully-realized character whose personal development, gear, and reputation are as important as their empire.

*   **Armoury & Gear System:**
    *   **Concept:** Introduce a personal inventory and gear system for the Mastermind. Players will be able to find, purchase, or be rewarded with unique items (Weapons, Armour, Specialist Tools) that provide significant bonuses and unlock new tactical options in Mastermind-led operations.
    *   **Mechanics:** Gear will have rarity tiers (Common to Legendary) and will be managed in a new "Armoury" tab within the Mastermind view.

*   **Expanded Trait & Scar System:**
    *   **Concept:** Build upon the existing trait system to introduce permanent, narrative-defining characteristics.
    *   **Mechanics:**
        *   **Origin Traits:** At character creation, players will select an "Origin" that provides a powerful bonus and a thematic drawback, shaping their early-game strategy.
        *   **Scars:** Critical failures in high-stakes operations will result in permanent negative traits ("Scars") that create emergent challenges and "comeback story" narratives.

*   **Feared vs. Respected Reputation System:**
    *   **Concept:** Evolve the reputation mechanic into a dual-sided system. Player actions will generate either "Fear" (from violence, extortion) or "Respect" (from clean operations, diplomacy).
    *   **Mechanics:** A new UI element will track this alignment. High Fear will make hostile takeovers easier but increase Heat and block diplomacy. High Respect will unlock unique recruitment and diplomatic options but may be less effective against hardened rivals.

---

### 2. The Architect of Power (Advanced Empire & Class Mechanics)

**Goal:** To fully realize the unique playstyle of each Ascendant Class and introduce deeper empire management challenges.

*   **Unique Class Mechanics:**
    *   **Concept:** Implement the core, game-changing mechanics exclusive to each Mastermind class.
    *   **Mechanics:**
        *   **Warlord:** Introduce the "War Machine" system, allowing the construction of military infrastructure (Barracks, Watchtowers) directly on the world map.
        *   **Spymaster:** Implement "The Ledger of Whispers," introducing "Secrets" as a strategic resource spent on powerful off-map actions like turning agents or fabricating scandals.
        *   **Industrialist:** Create the "Vassalage System," allowing for the economic subjugation of districts instead of direct conquest, creating a network of tributaries that pay tribute.

*   **District Loyalty & Rebellion:**
    *   **Concept:** Add a `loyalty` metric to each player-controlled district, making internal stability a new strategic challenge.
    *   **Mechanics:** Loyalty will be affected by Heat, successful/failed operations, and player actions. Low loyalty will reduce income and can eventually lead to a full-scale rebellion, forcing the player to either crush the dissent or lose the district.

*   **Core Skill System Refactor (High-Impact/High-Risk):**
    *   **Concept:** A potential major refactor to streamline the game's skills from the current five (`Combat`, `Cunning`, etc.) to three core pillars: **Force, Espionage, and Economic**.
    *   **Mechanics:** This would involve a significant overhaul of all characters, operations, and success calculations, but would create a clearer and more focused synergy with the Ascendant Classes.

---

### 3. A Living Underworld (Dynamic Faction Interaction)

**Goal:** To transform rival factions from simple antagonists into complex political entities that can be negotiated with, manipulated, and betrayed.

*   **Deep Diplomacy System:**
    *   **Concept:** Introduce a comprehensive diplomacy system.
    *   **Mechanics:**
        *   A relationship matrix will track standing between all major factions (including the player).
        *   Players will be able to engage in diplomatic actions through new operations: "Form Alliance," "Request Ceasefire," "Sow Discord" (turning two rivals against each other), and "Betray Ally."
        *   Alliances will provide shared intelligence and military support, while betrayals will have severe, long-term reputational consequences.
    *   **UI Impact:** A new "Diplomacy" or "Factions" view showing a web of relationships and allowing diplomatic actions.

---

### 4. Quality of Life & Immersion

**Goal:** To enhance the game's atmosphere and add finer layers of management.

*   **Deeper Crew Management:**
    *   **Concept:** Make crew members feel more like individuals and less like disposable assets.
    *   **Mechanics:** Introduce crew upkeep costs (salaries) that must be paid regularly. Failure to pay will drastically lower loyalty. Loyalty will fluctuate based on mission success, payment, and alignment with the Mastermind's reputation (e.g., a "Principled" character will lose loyalty in a "Feared" empire). Low loyalty can lead to crew members leaving or even betraying you.

*   **Art & Audio Overhaul:**
    *   **Concept:** Enhance the game's atmosphere with bespoke assets.
    *   **Mechanics:**
        *   **Unique Portraits:** Commission unique, stylized portraits for all Lieutenants to make them feel truly special.
        *   **Ambient Soundtrack:** Add a simple, atmospheric ambient soundtrack fitting the neo-noir theme.
        *   **UI Sound Effects:** Add subtle sound effects for key UI interactions to improve feedback and immersion.
