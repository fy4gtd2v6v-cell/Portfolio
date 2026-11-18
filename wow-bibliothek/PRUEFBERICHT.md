# Prüfbericht – Abgleich mit den Datenbanken

Stand: 18.11.2026. Alle Dungeons, Schlachtzüge, Bosse, Quests und Gegenstände der Azeroth-Bibliothek
wurden gegen zwei öffentliche Datenbanken geprüft:

| Quelle | Inhalt | Verwendet für |
| --- | --- | --- |
| [QuestieDB](https://github.com/Questie/QuestieDB), Variante **Forever** (GPLv3) | Quests, NPCs, Gegenstände, deutsche Übersetzungen, Dungeon-Eingänge | Namen DE/EN, Stufen, Questgeber, Fraktion, Koordinaten, offizieller Questtext, Belohnungen, Drop-Zuordnung |
| [wow-classic-items](https://www.npmjs.com/package/wow-classic-items) 0.8.2 (Classic-Stand 2020) | Qualität, Slot, Tooltip-Werte, Dropchance | Farben, Werte im Tooltip, Dropchancen |

Die neuere Version 2.0.1 von wow-classic-items enthält bei rund der Hälfte der Gegenstände bereits
Werte aus Burning Crusade (z. B. „critical strike rating“). Sie wird nur für Gegenstände genutzt, die in 0.8.2 fehlen,
und dann ohne diese Zeilen.

## Die wichtigsten Korrekturen

**Beute an falschem Boss**
- Ironfoe droppt bei **Imperator Dagran Thaurissan**, nicht bei Fineous Darkvire.
- Lavishly Jeweled Ring droppt bei **Gilnid**, nicht bei Sneed.
- Haunting Blade droppt beim seltenen **Deathsworn Captain**, nicht bei Commander Springvale.
- Scarlet Leggings droppen bei **Scarlet Commander Mograine**, nicht bei Herod.
- Gemstone of Smolderthorn: **War Master Voone**; Gemstone of Bloodaxe: **Overlord Wyrmthalak**.
- Fathom Core stammt aus dem **Fathom Stone** (Objekt), nicht von Baron Aquanis.

**Qualität**
- Viele frühe Dungeon-Drops waren in Classic **grün oder weiß** und wurden erst mit TBC-Patch 2.3 blau
  (z. B. Rhahk'Zor's Hammer, Buzzer Blade, Belt of the Fang). Die Farben folgen jetzt dem Classic-Stand.

**Quests**
- „The Royal Rescue“ ist eine **Horde**-Quest von Thrall. Das Allianz-Gegenstück heißt „The Fate of the Kingdom“ (König Magni) – neu aufgenommen.
- „Dark Iron Legacy“: Ironfel holt man von **Fineous Darkvire** (nicht Pyromancer Loregrain).
- „Plagued Hatchlings“ gibt **Betina Bigglezink** (Kapelle des Hoffnungsvollen Lichts), für beide Fraktionen.
- „Going, Going, Guano!“ gibt **Apothekermeister Faranell** in Unterstadt.
- „Necklace Recovery“ ist eine **Horde**-Quest (Dran Droffers, Orgrimmar).
- Vorrel-Quest heißt **„Vorrel's Revenge“** und startet bei Vorrel Sengutz im Kloster.
- „Save Techbot!“ heißt korrekt **„Save Techbot's Brain!“**.
- „Lord Victor Nefarius“ gibt es nicht – die Kopf-Quest heißt für beide Fraktionen **„The Lord of Blackrock“**.
- Die Quintessenz-Quest heißt **„Hands of the Enemy“** (Duke Hydraxis).
- „A Fine Mess“, „Uldaman Reagent Run“ und „Lethtendris's Web“ gibt es für **beide Fraktionen** (mit eigenem Questgeber).
- Belohnungen kommen jetzt aus der Datenbank; mehrere von mir geschätzte Belohnungen waren falsch
  (z. B. „Compendium of the Fallen“: Vile Protector, Omega Orb, Forcestone Buckler).

**Neu ergänzt**
- Deutsche Namen für Dungeons, Bosse, Quests, Questgeber, Zonen und Gegenstände (offizielle Übersetzungen).
- Bossstufen, offizieller deutscher Questtext, Questgeber je Fraktion mit Koordinaten aus World of Warcraft Forever.
- Vollständige Beutelisten mit Dropchance und Tooltip-Werten – statt Platzhaltern wie „Tier-1-Set: Füße“.

**Nicht belegt (markiert mit ⚠)**
- Mature Blue Dragon Sinew (Azuregos) und Hammer of Bestial Fury (Drachen des Albtraums) haben in beiden Datenbanken keine Quelle.

**Nicht prüfbar**
- Taktiken, Abläufe, Beschreibungen und Quest-Schritte sind von Hand geschrieben und stehen in keiner der Datenbanken.

---

## Vollständiges Protokoll des Abgleichs

## Drops ergänzt (172)
- Der Flammenschlund – Taragaman the Hungerer: +3 (Crystalline Cuffs, Cursed Felblade, Subterranean Cape)
- Der Flammenschlund – Jergosh the Invoker: +3 (Cavedweller Bracers, Chanting Blade, Robe of Evocation)
- Die Todesminen – Rhahk'Zor: +1 (Rockslicer)
- Die Todesminen – Miner Johnson: +2 (Gold-plated Buckler, Miner's Cape)
- Die Todesminen – Sneed's Shredder / Sneed: +3 (Taskmaster Axe, Buzz Saw, Gold-flecked Gloves)
- Die Todesminen – Gilnid: +1 (Lavishly Jeweled Ring)
- Die Todesminen – Mr. Smite: +1 (Smite's Reaver)
- Die Todesminen – Captain Greenskin: +2 (Blackened Defias Belt, Impaling Harpoon)
- Die Todesminen – Edwin VanCleef: +1 (Corsair's Overshirt)
- Die Todesminen – Cookie: +2 (Viridian Band, Cat Carrier (Siamese))
- Die Höhlen des Wehklagens – Lady Anacondra: +2 (Serpent's Shoulders, Gem of Anacondra)
- Die Höhlen des Wehklagens – Lord Cobrahn: +3 (Cobrahn's Grasp, Robe of the Moccasin, Gem of Cobrahn)
- Die Höhlen des Wehklagens – Lord Pythas: +1 (Gem of Pythas)
- Die Höhlen des Wehklagens – Skum: +1 (Tail Spike)
- Die Höhlen des Wehklagens – Lord Serpentis: +4 (Venomstrike, Savage Trodders, Serpent Gloves, Gem of Serpentis)
- Die Höhlen des Wehklagens – Mutanus the Devourer: +1 (Deep Fathom Ring)
- Burg Schattenfang – Rethilgore: +1 (Rugged Spaulders)
- Burg Schattenfang – Razorclaw the Butcher: +2 (Bloody Apron, Butcher's Slicer)
- Burg Schattenfang – Commander Springvale: +1 (Arced War Axe)
- Burg Schattenfang – Odo the Blindwatcher: +1 (Girdle of the Blindwatcher)
- Burg Schattenfang – Fenrus the Devourer: +2 (Black Wolf Bracers, Fenrus' Hide)
- Burg Schattenfang – Wolf Master Nandos: +2 (Feline Mantle, Wolfmaster Cape)
- Tiefschwarze Grotte – Ghamoo-ra: +1 (Ghamoo-ra's Bind)
- Tiefschwarze Grotte – Lady Sarevess: +2 (Darkwater Talwar, Naga Heartpiercer)
- Tiefschwarze Grotte – Gelihast: +3 (Algae Fists, Reef Axe, Murloc Skin Bag)
- Tiefschwarze Grotte – Baron Aquanis: +1 (Strange Water Globe)
- Tiefschwarze Grotte – Twilight Lord Kelris: +1 (Gaze Dreamer Pants)
- Tiefschwarze Grotte – Aku'mai: +3 (Leech Pants, Moss Cinch, Strike of the Hydra)
- Das Verlies – Targorr the Dread: +1 (Head of Targorr)
- Das Verlies – Kam Deepfury: +1 (Kam's Walking Stick)
- Das Verlies – Bruegal Ironknuckle: +3 (Iron Knuckles, Jimmied Handcuffs, Prison Shank)
- Das Scharlachrote Kloster – Interrogator Vishas: +2 (Torturing Poker, Bloody Brass Knuckles)
- Das Scharlachrote Kloster – Bloodmage Thalnos: +2 (Orb of the Forgotten Seer, Bloodmage Mantle)
- Das Scharlachrote Kloster – Houndmaster Loksey: +2 (Loksey's Training Stick, Dog Training Gloves)
- Das Scharlachrote Kloster – Herod: +1 (Raging Berserker's Helm)
- Das Scharlachrote Kloster – Scarlet Commander Mograine: +2 (Aegis of the Scarlet Commander, Scarlet Leggings)
- Zul'Farrak – Antu'sul: +4 (Lifeblood Amulet, Sang'thraze the Deflector, The Hand of Antu'sul, Vice Grips)
- Zul'Farrak – Theka the Martyr: +3 (Eyegouger, Flaming Incinerator, Troll Protector)
- Zul'Farrak – Witch Doctor Zum'rah: +2 (Jumanza Grips, Zum'rah's Vexing Cane)
- Zul'Farrak – Sergeant Bly & Gruppe: +3 (Blackmetal Cape, Bloodletter Scalpel, Witch Doctor's Cane)
- Zul'Farrak – Nekrum Gutchewer & Shadowpriest Sezz'ziz: +6 (Bad Mojo Mask, Diabolic Skiver, Eyegouger, Jinxed Hoodoo Kilt, Jinxed Hoodoo Skin, Nekrum's Medallion)
- Zul'Farrak – Hydromancer Velratha: +2 (Flaming Incinerator, The Minotaur)
- Zul'Farrak – Chief Ukorz Sandscalp: +5 (Big Bad Pauldrons, Embrace of the Lycan, Jang'thraze the Protector, Ripsaw, The Chief's Enforcer)
- Maraudon – Noxxion: +4 (Heart of Noxxion, Noxious Shooter, Noxxion's Shackles, Celebrian Rod)
- Maraudon – Razorlash: +6 (Phytoskin Spaulders, Vinerot Sandals, Brusslehide Leggings, Chloromesh Girdle, Razorlash Root, Well Stone)
- Maraudon – Lord Vyletongue: +4 (Infernal Trickster Leggings, Satyr's Lash, Satyrmane Sash, Celebrian Diamond)
- Maraudon – Celebras the Cursed: +3 (Claw of Celebras, Grovekeeper's Drape, Soothsayer's Headdress)
- Maraudon – Landslide: +4 (Cloud Stone, Fist of Stone, Helm of the Mountain, Rockgrip Gauntlets)
- Maraudon – Tinkerer Gizlock: +3 (Gizlock's Hypertech Buckler, Inventor's Focal Sword, Megashot Rifle)
- Maraudon – Rotgrip: +4 (Albino Crocscale Boots, Gatorbite Axe, Rotgrip Mantle, Emitter Spare Part)
- Maraudon – Princess Theradras: +7 (Blade of Eternal Darkness, Bracers of the Stone Princess, Charstone Dirk, Elemental Rockridge Leggings, Eye of Theradras, Gemshard Heart …)
- Schwarzfelstiefen – Lord Roccor: +6 (Earthslag Shoulders, Idol of Ferocity, Mantle of Lost Hope, Rockshard Pellets, Stoneshell Guard, Formula: Smoking Heart of the Mountain)
- Schwarzfelstiefen – High Interrogator Gerstahn: +5 (Blackveil Cape, Enthralled Sphere, Greaves of Withering Despair, Kentic Amice, Prison Cell Key)
- Schwarzfelstiefen – Ring of Law: +25 (Savage Gladiator Chain, Ban'thok Sash, Bloodclot Band, Carapace of Anub'shiah, Cyclopean Band, Dregmetal Spaulders …)
- Schwarzfelstiefen – Golem Lord Argelmach: +7 (Luminary Kilt, Naglering, Omnicast Boots, Second Wind, Design: Dark Iron Scorpid, Head of Argelmach …)
- Schwarzfelstiefen – Hurley Blackbreath: +5 (Coal Miner Boots, Firemoss Boots, Hurley's Tankard, Ragefury Eyepatch, Lost Thunderbrew Recipe)
- Schwarzfelstiefen – Fineous Darkvire: +6 (Chief Architect's Monocle, Foreman's Head Protector, Lead Surveyor's Mantle, Senior Designer's Pantaloons, Master Builder's Shirt, Ironfel)
- Schwarzfelstiefen – General Angerforge: +5 (Force of Will, Lord General's Sword, Royal Decorated Armor, Warstrife Leggings, Marshal Windsor's Lost Information)
- Schwarzfelstiefen – Ambassador Flamelash: +5 (Circle of Flame, Burst of Knowledge, Cape of the Fire Salamander, Flame Wrath, Molten Fists)
- Schwarzfelstiefen – Magmus: +5 (Golem Skull Helm, Lavastone Hammer, Libram of Truth, Magmus Stone, Totem of Rage)
- Schwarzfelstiefen – Emperor Dagran Thaurissan: +11 (Ironfoe, Dreadforge Retaliator, Emperor's Seal, Guiding Stave of Wisdom, Imperial Jewel, Robes of the Royal Crown …)
- Scholomance – Kirtonos the Herald: +9 (Boots of Valor, Clutch of Andros, Frightalon, Gargoyle Slashers, Gravestone War Axe, Heart of the Fiend …)
- Scholomance – Jandice Barov: +9 (Barovian Family Sword, Darkshade Gloves, Dreadmist Mantle, Ghostloom Leggings, Phantasmal Cloak, Royal Cap Spaulders …)
- Scholomance – Rattlegore: +9 (Bone Golem Shoulders, Bone Ring Helm, Corpselight Greaves, Deadwalker Mantle, Frightskull Shaft, Rattlecage Buckler …)
- Scholomance – Ras Frostwhisper: +15 (Alanna's Embrace, Bonechill Hammer, Boneclenched Gauntlets, Death's Clutch, Freezing Lich Robes, Frostbite Girdle …)
- Scholomance – Darkmaster Gandling: +21 (Headmaster's Charge, Pattern: Robe of the Void, Ace of Portals, Beaststalker's Cap, Bonecreeper Stylus, Boots of the Shrieker …)
- Stratholme – Timmy the Cruel: +5 (Grimgore Noose, Lightforge Gauntlets, The Cruel Hand of Timmy, Timmy's Galoshes, Vambraces of the Sadist)
- Stratholme – Cannon Master Willey: +13 (Barrage Girdle, Cannonball Runner, Diana's Pearl Necklace, Helm of the New Moon, Mantle of the Scarlet Crusade, Master Cannoneer Boots …)
- Stratholme – Archivist Galford: +6 (Archivist Cape, Ash Covered Boots, Devout Gloves, Foresight Girdle, Tome of Conjure Food VII, Tome of Knowledge)
- Stratholme – Balnazzar: +14 (Book of the Dead, Pattern: Truefaith Vestments, Crown of Tyranny, Demonshear, Fire Striders, Gift of the Elven Magi …)
- Stratholme – Baroness Anastari: +10 (Anastari Heirloom, Banshee Finger, Dreadmist Sandals, Screeching Bow, Shadowy Laced Handwraps, Banshee's Touch …)
- Stratholme – Nerub'enkan: +10 (Beaststalker's Boots, Carapace Spine Crossbow, Chitinous Plate Legguards, Husk of Nerub'enkan, Thuzadin Sash, Acid-etched Pauldrons …)
- Stratholme – Maleki the Pallid: +11 (Bone Slicing Hatchet, Devout Sandals, Maleki's Footwraps, Pale Moon Cloak, Plans: Hammer of the Titans, Skull of Burning Shadows …)
- Stratholme – Magistrate Barthilas: +6 (Crimson Felt Hat, Death Grips, Idol of Brutality, Magistrate's Cuffs, Peacemaker, Royal Tribunal Cloak)
- Stratholme – Ramstein the Gorger: +8 (Animated Chain Necklace, Band of Flesh, Crest of Retribution, Gauntlets of Valor, Ramstein's Lightning Bolts, Slavedriver's Cane …)
- Stratholme – Baron Rivendare: +22 (Beaststalker's Pants, Bonescraper, Cape of the Black Baron, Devout Skirt, Dracorian Gauntlets, Dreadmist Leggings …)
- Gnomeregan – Grubbis: +1 (Grubbis Paws)
- Gnomeregan – Viscous Fallout: +3 (Acidic Walkers, Hydrocane, Toxic Revenger)
- Gnomeregan – Electrocutioner 6000: +3 (Electrocutioner Lagnut, Electrocutioner Leg, Spidertank Oilrag)
- Gnomeregan – Crowd Pummeler 9-60: +2 (Gnomebot Operating Boots, Schematic: Lil' Smoky)
- Gnomeregan – Dark Iron Ambassador: +3 (Emissary Cuffs, Glass Shooter, Royal Diplomatic Scepter)
- Gnomeregan – Mekgineer Thermaplugg: +11 (Charged Gear, Electromagnetic Gigaflux Reactivator, Thermaplugg's Central Core, Thermaplugg's Left Arm, Schematic: Discombobulator Ray, Schematic: Flame Deflector …)
- Kral der Klingenhauer – Roogug: +1 (Vial of Phlogiston)
- Kral der Klingenhauer – Aggem Thorncurse: +1 (Thornspike)
- Kral der Klingenhauer – Death Speaker Jargba: +3 (Death Speaker Scepter, Death Speaker Mantle, Death Speaker Robes)
- Kral der Klingenhauer – Overlord Ramtusk: +2 (Corpsemaker, Tusken Helm)
- Kral der Klingenhauer – Agathelos the Raging: +2 (Swinetusk Shank, Ferine Leggings)
- Kral der Klingenhauer – Blind Hunter: +3 (Batwing Mantle, Nightstalker Bow, Stygian Bone Amulet)
- Kral der Klingenhauer – Charlga Razorflank: +6 (Agamaggan's Clutch, Heart of Agamaggan, Pronged Reaver, Small Scroll, Razorflank's Heart, Razorflank's Medallion)
- Hügel der Klingenhauer – Tuten'kash: +3 (Arachnid Gloves, Carapace of Tuten'kash, Silky Spider Cape)
- Hügel der Klingenhauer – Mordresh Fire Eye: +3 (Deathmage Sash, Glowing Eye of Mordresh, Mordresh's Lifeless Skull)
- Hügel der Klingenhauer – Glutton: +2 (Fleshhide Shoulders, Glutton's Cleaver)
- Hügel der Klingenhauer – Ragglesnout: +3 (Boar Champion's Belt, Savage Boar's Guard, X'caliboar)
- Hügel der Klingenhauer – Plaguemaw the Rotting: +2 (Plaguerot Sprig, Swine Fists)
- Hügel der Klingenhauer – Amnennar the Coldbringer: +6 (Coldrage Dagger, Deathchill Armor, Icemetal Barbute, Robes of the Lich, Bonefingers, Skull of the Coldbringer)
- Uldaman – Revelosh: +5 (Revelosh's Armguards, Revelosh's Boots, Revelosh's Gloves, Revelosh's Spaulders, The Shaft of Tsol)
- Uldaman – Baelog & Olaf & Eric: +13 (Horned Viking Helmet, Nordic Longshank, Olaf's All Purpose Shield, Worn Running Boots, Baelog's Shortbow, Battered Viking Shield …)
- Uldaman – Ironaya: +3 (Ironaya's Bracers, Ironshod Bludgeon, Stoneweaver Leggings)
- Uldaman – Obsidian Sentinel: +1 (Obsidian Power Source)
- Uldaman – Ancient Stone Keeper: +2 (Cragfists, Rockshard Pauldrons)
- Uldaman – Galgann Firehammer: +4 (Flameseer Mantle, Galgann's Fireblaster, Emberscale Cape, Galgann's Firehammer)
- Uldaman – Grimlok: +4 (Grimlok's Charge, Grimlok's Tribal Vestments, Oilskin Leggings, Shattered Necklace Sapphire)
- Uldaman – Archaedas: +4 (Archaedic Stone, Stoneslayer, The Rockpounder, Shattered Necklace Power Source)
- Versunkener Tempel – Atal'alarion: +4 (Atal'alarion's Tusk Ring, Darkwater Bracers, Headspike, Putrid Vine)
- Versunkener Tempel – Jammal'an the Prophet & Ogom the Wretched: +6 (Gloves of the Atal'ai Prophet, Kilt of the Atal'ai Prophet, Vestments of the Atal'ai Prophet, Blade of the Wretched, Eater of the Dead, Fist of the Damned)
- Versunkener Tempel – Morphaz & Hazzas: +4 (Arcane Shard, Azure Key, Blood of Morphaz, Tooth of Morphaz)
- Versunkener Tempel – Shade of Eranikus: +7 (Dragon's Call, Crest of Supremacy, Dire Nail, Dragon's Eye, Horns of Eranikus, Rod of Corrosion …)
- Versunkener Tempel – Avatar of Hakkar: +1 (Essence of Hakkar)
- Düsterbruch – Pusillin: +3 (Recipe: Runn Tum Tuber Surprise, Runn Tum Tuber, Book of Incantations)
- Düsterbruch – Zevrim Thornhoof: +5 (Fervent Helm, Helm of Awareness, Satyr's Bow, Clever Hat, Gloves of Shadowy Mist)
- Düsterbruch – Lethtendris: +4 (Felhide Cap, Quel'dorai Channeling Rod, Band of Vigor, Lethtendris's Wand)
- Düsterbruch – Alzzin the Wildshaper: +10 (Energetic Rod, Energized Chestplate, Fiendish Machete, Gloves of Restoration, Merciful Greaves, Razor Gauntlets …)
- Düsterbruch – Tendris Warpwood: +4 (Tanglemoss Leggings, Warpwood Binding, Petrified Bark Shield, Stoneflower Staff)
- Düsterbruch – Immol'thar: +10 (Bile-etched Spaulders, Blade of the New Moon, Cloak of the Cosmos, Demon Howl Wristguards, Evil Eye Pendant, Eyestalk Cord …)
- Düsterbruch – Prince Tortheldrin: +10 (Bracers of the Eclipse, Chestplate of Tranquility, Distracting Dagger, Eldritch Reinforced Legplates, Emerald Flame Ring, Fluctuating Cloak …)
- Düsterbruch – King Gordok: +10 (Ace of Warlords, Band of the Ogre King, Barbarous Blade, Bracers of Prosperity, Brightly Glowing Stone, Crown of the Ogre King …)
- Schwarzfelsspitze – Highlord Omokk: +7 (Boots of Elements, Fist of Omokk, Plate of the Shaman King, Skyshroud Leggings, Slamshot Shoulders, Tressermane Leggings …)
- Schwarzfelsspitze – Shadow Hunter Vosh'gajin: +8 (Blackcrow, Demonic Runed Spaulders, Doomshot, Funeral Cuffs, Riphook, Shadowcraft Gloves …)
- Schwarzfelsspitze – War Master Voone: +8 (Beaststalker's Gloves, Brazecore Armguards, Flightblade Throwing Axe, Kayser's Boots of Precision, Keris of Zul'Serak, Talisman of Evasion …)
- Schwarzfelsspitze – Mother Smolderweb: +4 (Gilded Gauntlets, Smolderweb's Eye, Venomspitter, Wildheart Boots)
- Schwarzfelsspitze – Urok Doomhowl: +6 (Marksman's Girdle, Ribsteel Footguards, Rosewine Circle, Slaghide Gauntlets, Top Half of Advanced Armorsmithing: Volume III, Warosh's Mojo)
- Schwarzfelsspitze – Overlord Wyrmthalak: +10 (Mark of the Dragon Lord, Beaststalker's Mantle, Chillpike, Heart of Wyrmthalak, Heart of the Scale, Reiver Claws …)
- Schwarzfelsspitze – Pyroguard Emberseer: +8 (Emberfury Talisman, Flaming Band, Gauntlets of Elements, Tablet of Flame Shock VI, Truestrike Shoulders, Wildfire Cape …)
- Schwarzfelsspitze – Warchief Rend Blackhand & Gyth: +19 (Chromatic Carapace, Felstriker, Band of Rumination, Battleborn Armbraces, Blackhand Doomsaw, Bonespike Shoulder …)
- Schwarzfelsspitze – The Beast: +11 (Ace of Beasts, Blackmist Armguards, Blademaster Leggings, Bloodmoon Cloak, Finkle's Skinner, Frostweaver Cape …)
- Schwarzfelsspitze – General Drakkisath: +20 (Blackblade of Shahram, Beaststalker's Tunic, Breastplate of Valor, Brigam Girdle, Devout Robe, Draconian Deflector …)
- Geschmolzener Kern – Lucifron: +9 (Arcanist Boots, Cenarion Boots, Choker of Enlightenment, Earthfury Boots, Felheart Gloves, Gauntlets of Might …)
- Geschmolzener Kern – Magmadar: +10 (Arcanist Leggings, Cenarion Leggings, Earthfury Legguards, Eskhandar's Right Claw, Felheart Pants, Giantstalker's Leggings …)
- Geschmolzener Kern – Gehennas: +7 (Earthfury Gauntlets, Giantstalker's Boots, Gloves of Prophecy, Lawbringer Gauntlets, Nightslayer Gloves, Sabatons of Might …)
- Geschmolzener Kern – Garr: +12 (Bindings of the Windseeker, Arcanist Crown, Cenarion Helm, Circlet of Prophecy, Drillborer Disk, Earthfury Helmet …)
- Geschmolzener Kern – Shazzrah: +7 (Arcanist Gloves, Boots of Prophecy, Cenarion Gloves, Felheart Slippers, Giantstalker's Gloves, Nightslayer Boots …)
- Geschmolzener Kern – Baron Geddon: +7 (Bindings of the Windseeker, Arcanist Mantle, Cenarion Spaulders, Earthfury Epaulets, Felheart Shoulder Pads, Lawbringer Spaulders …)
- Geschmolzener Kern – Golemagg the Incinerator: +9 (Arcanist Robes, Breastplate of Might, Cenarion Vestments, Earthfury Vestments, Felheart Robes, Giantstalker's Breastplate …)
- Geschmolzener Kern – Sulfuron Harbinger: +5 (Giantstalker's Epaulets, Mantle of Prophecy, Nightslayer Shoulder Pads, Pauldrons of Might, Hand of Sulfuron)
- Geschmolzener Kern – Majordomo Executus: +7 (Ancient Petrified Leaf, Core Hound Tooth, Fireproof Cloak, Sash of Whispered Secrets, The Eye of Divinity, Wild Growth Spaulders …)
- Geschmolzener Kern – Ragnaros: +19 (Essence of the Firelord, Band of Sulfuras, Bloodfang Pants, Choker of the Fire Lord, Cloak of the Shrouded Mists, Crown of Destruction …)
- Onyxias Hort – Onyxia: +6 (Ancient Cornerstone Grimoire, Draconic for Dummies, Mature Black Dragon Sinew, Grimoire of Shadow Ward IV, Scale of Onyxia, Onyxia Hide Backpack)
- Pechschwingenhort – Razorgore the Untamed: +15 (Arcane Infused Gem, Bindings of Transcendence, Bloodfang Bracers, Bracelets of Wrath, Bracers of Ten Storms, Dragonstalker's Bracers …)
- Pechschwingenhort – Vaelastrasz the Corrupt: +15 (Belt of Ten Storms, Belt of Transcendence, Bloodfang Belt, Dragonfang Blade, Dragonstalker's Belt, Helm of Endless Rage …)
- Pechschwingenhort – Broodlord Lashlayer: +16 (Black Brood Pauldrons, Bloodfang Boots, Boots of Transcendence, Bracers of Arcane Accuracy, Dragonstalker's Greaves, Greaves of Ten Storms …)
- Pechschwingenhort – Firemaw / Ebonroc / Flamegor: +20 (Aegis of Preservation, Band of Forced Concentration, Black Ash Robe, Circle of Applied Force, Claw of the Black Drake, Cloak of Firemaw …)
- Pechschwingenhort – Chromaggus: +21 (Angelista's Grasp, Ashjre'thul, Crossbow of Smiting, Bloodfang Spaulders, Chromatic Boots, Claw of Chromaggus, Dragonstalker's Spaulders …)
- Pechschwingenhort – Nefarian: +21 (Archimtiros' Ring of Reckoning, Bloodfang Chestpiece, Boots of the Shadow Flame, Breastplate of Ten Storms, Breastplate of Wrath, Cloak of the Brood Lord …)
- Zul'Gurub – High Priestess Jeklik: +7 (Jeklik's Crusher, Animist's Spaulders, Jeklik's Opaline Talisman, Peacekeeper Boots, Primalist's Band, Seafury Boots …)
- Zul'Gurub – High Priest Venoxis: +7 (Fang of Venoxis, Runed Bloodstained Hauberk, Blooddrenched Footpads, Zanzil's Band, Zulian Stone Axe, Zulian Tigerhide Cloak …)
- Zul'Gurub – High Priestess Mar'li: +6 (Flowing Ritual Robes, Mar'li's Touch, Band of Jin, Bloodstained Greaves, Mar'li's Eye, Talisman of Protection)
- Zul'Gurub – Bloodlord Mandokir: +12 (Bloodlord's Defender, Halberd of Smiting, Mandokir's Sting, Animist's Leggings, Blooddrenched Grips, Bloodsoaked Pauldrons …)
- Zul'Gurub – High Priest Thekal: +7 (Betrayer's Boots, Thekal's Grasp, Peacekeeper Leggings, Ritualistic Legguards, Seafury Leggings, Seal of Jin …)
- Zul'Gurub – High Priestess Arlokk: +6 (Arlokk's Grasp, Will of Arlokk, Arlokk's Hoodoo Stick, Bloodsoaked Greaves, Overlord's Onyx Band, Panther Hide Sack)
- Zul'Gurub – Jin'do the Hexxer: +13 (Jin'do's Bag of Whammies, Jin'do's Evil Eye, Jin'do's Hexxer, Jin'do's Judgement, Animist's Boots, Blooddrenched Leggings …)
- Zul'Gurub – Hakkar: +14 (Aegis of the Blood God, Ancient Hakkari Manslayer, Bloodcaller, Bloodsoaked Legplates, Cloak of Consumption, Fang of the Faceless …)
- Ruinen von Ahn'Qiraj – Kurinnaxx: +9 (Qiraji Sacrificial Dagger, Vestments of the Shifting Sands, Belt of the Inquisition, Belt of the Sand Reaver, Qiraji Martial Drape, Qiraji Regal Drape …)
- Ruinen von Ahn'Qiraj – General Rajaxx: +8 (Boots of the Vanguard, Manslayer of the Qiraji, Boots of the Qiraji General, Bracers of Qiraji Command, Legplates of the Qiraji Command, Qiraji Martial Drape …)
- Ruinen von Ahn'Qiraj – Moam: +16 (Dustwind Turban, Gauntlets of the Immovable, Qiraji Ornate Hilt, Qiraji Spiked Hilt, Talon of Furious Concentration, Thick Silithid Chestguard …)
- Ruinen von Ahn'Qiraj – Buru the Gorger: +11 (Buru's Skull Fragment, Gloves of the Swarm, Qiraji Ornate Hilt, Qiraji Spiked Hilt, Slimy Scaled Gauntlets, Fetish of Chitinous Spikes …)
- Ruinen von Ahn'Qiraj – Ayamiss the Hunter: +12 (Bow of Taut Sinew, Gauntlets of the Immovable, Qiraji Ornate Hilt, Qiraji Spiked Hilt, Stinger of Ayamiss, Boots of the Desert Protector …)
- Ruinen von Ahn'Qiraj – Ossirian the Unscarred: +15 (Bracers of Brutality, Crossbow of Imminent Doom, Gauntlets of New Life, Gloves of Dark Wisdom, Helm of Domination, Leggings of the Black Blizzard …)
- Tempel von Ahn'Qiraj – The Prophet Skeram: +14 (Amulet of Foul Warding, Barrage Shoulders, Beetle Scaled Wristguards, Boots of the Fallen Prophet, Boots of the Redeemed Prophecy, Boots of the Unwavering Will …)
- Tempel von Ahn'Qiraj – Silithid Royalty (Bug Trio): +19 (Angelista's Charm, Angelista's Touch, Bile-Covered Gauntlets, Boots of the Fallen Hero, Cape of the Trinity, Gloves of Ebru …)
- Tempel von Ahn'Qiraj – Battleguard Sartura: +13 (Badge of the Swarmguard, Creeping Vine Helm, Gauntlets of Steadfast Determination, Gloves of Enforcement, Leggings of the Festering Swarm, Legplates of Blazing Light …)
- Tempel von Ahn'Qiraj – Fankriss the Unyielding: +13 (Ancient Qiraji Ripper, Barb of the Sand Reaver, Barbed Choker, Cloak of Untold Secrets, Fetish of the Sand Reaver, Hive Tunneler's Boots …)
- Tempel von Ahn'Qiraj – Viscidus: +9 (Gauntlets of Kalimdor, Gauntlets of the Righteous Champion, Idol of Health, Qiraji Bindings of Command, Qiraji Bindings of Dominance, Ring of the Qiraji Fury …)
- Tempel von Ahn'Qiraj – Princess Huhuran: +8 (Cloak of the Golden Hive, Gloves of the Messiah, Hive Defiler Wristguards, Huhuran's Stinger, Qiraji Bindings of Command, Qiraji Bindings of Dominance …)
- Tempel von Ahn'Qiraj – Twin Emperors: +17 (Amulet of Vek'nilash, Belt of the Fallen Emperor, Boots of Epiphany, Bracelets of Royal Redemption, Gloves of the Hidden Temple, Grasp of the Fallen Emperor …)
- Tempel von Ahn'Qiraj – Ouro: +8 (Burrower Bracers, Don Rigoberto's Lost Hat, Jom Gabbar, Larvae of the Great Worm, Ouro's Intact Hide, Skin of the Great Sandworm …)
- Tempel von Ahn'Qiraj – C'Thun: +15 (Base of Atiesh, Belt of Never-ending Agony, Carapace of the Old God, Cloak of Clarity, Cloak of the Devoured, Dark Storm Gauntlets …)
- Naxxramas – Anub'Rekhan / Faerlina / Maexxna: +21 (Band of Unanswered Prayers, Cryptfiend Silk Cloak, Crystal Webbed Robe, Desecrated Bindings, Desecrated Bracers, Desecrated Gauntlets …)
- Naxxramas – Noth / Heigan / Loatheb: +23 (Band of Unnatural Forces, Band of the Inevitable, Brimstone Staff, Cloak of the Scourge, Desecrated Belt, Desecrated Girdle …)
- Naxxramas – Razuvious / Gothik / Four Horsemen: +14 (Boots of Displacement, Desecrated Boots, Desecrated Sabatons, Desecrated Sandals, Girdle of the Mentor, Glacial Headdress …)
- Naxxramas – Patchwerk / Grobbulus / Gluth / Thaddius: +36 (Band of Reanimation, Claymore of Unholy Might, Cloak of Suturing, Death's Bargain, Desecrated Belt, Desecrated Bindings …)
- Naxxramas – Sapphiron: +15 (Claw of the Frost Wyrm, Cloak of the Necropolis, Eye of the Dead, Fists of the Unrelenting, Fortitude of the Scourge, Glyph of Deflection …)
- Naxxramas – Kel'Thuzad: +22 (Staff Head of Atiesh, Bonescythe Ring, Doomfinger, Frostfire Ring, Gem of Trapped Innocents, Gressil, Dawn of Ruin …)

## Drops korrigiert (31)
- Die Todesminen – Sneed's Shredder / Sneed: „Lavishly Jeweled Ring“ droppt laut Datenbank bei **Gilnid** → hier entfernt
- Burg Schattenfang – Commander Springvale: „Haunting Blade“ droppt laut Datenbank bei **Deathsworn Captain** → hier entfernt
- Tiefschwarze Grotte – Baron Aquanis: „Fathom Core“ droppt laut Datenbank bei **einem Objekt** → hier entfernt
- Das Scharlachrote Kloster – Herod: „Scarlet Leggings“ droppt laut Datenbank bei **Scarlet Commander Mograine** → hier entfernt
- Schwarzfelstiefen – Fineous Darkvire: „Ironfoe“ droppt laut Datenbank bei **Emperor Dagran Thaurissan** → hier entfernt
- Scholomance – Darkmaster Gandling: Platzhalter „Dungeon-Set-Helm (je nach Klasse)“ → durch echte Gegenstände ersetzt
- Uldaman – Baelog & Olaf & Eric: Platzhalter „Baelog's Journal“ → durch echte Gegenstände ersetzt
- Düsterbruch – King Gordok: Platzhalter „Gordok Tribute“ → durch echte Gegenstände ersetzt
- Schwarzfelsspitze – Shadow Hunter Vosh'gajin: „Gemstone of Smolderthorn“ droppt laut Datenbank bei **War Master Voone** → hier entfernt
- Schwarzfelsspitze – War Master Voone: „Gemstone of Bloodaxe“ droppt laut Datenbank bei **Overlord Wyrmthalak** → hier entfernt
- Schwarzfelsspitze – General Drakkisath: Platzhalter „Dungeon-Set-Brust (je nach Klasse)“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Lucifron: Platzhalter „Tier-1-Set: Füße“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Magmadar: Platzhalter „Tier-1-Set: Beine“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Gehennas: Platzhalter „Tier-1-Set: Hände“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Garr: Platzhalter „Tier-1-Set: Kopf“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Garr: Platzhalter „Bindings of the Windseeker (links)“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Shazzrah: Platzhalter „Tier-1-Set: Hände“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Baron Geddon: Platzhalter „Tier-1-Set: Schultern“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Baron Geddon: Platzhalter „Bindings of the Windseeker (rechts)“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Golemagg the Incinerator: Platzhalter „Tier-1-Set: Brust“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Sulfuron Harbinger: Platzhalter „Tier-1-Set: Schultern“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Majordomo Executus: Platzhalter „Cache of the Firelord“ → durch echte Gegenstände ersetzt
- Geschmolzener Kern – Ragnaros: Platzhalter „Tier-2-Set: Beine“ → durch echte Gegenstände ersetzt
- Pechschwingenhort – Razorgore the Untamed: Platzhalter „Tier-2-Set: Handgelenke“ → durch echte Gegenstände ersetzt
- Pechschwingenhort – Vaelastrasz the Corrupt: Platzhalter „Tier-2-Set: Taille“ → durch echte Gegenstände ersetzt
- Pechschwingenhort – Broodlord Lashlayer: Platzhalter „Tier-2-Set: Füße“ → durch echte Gegenstände ersetzt
- Pechschwingenhort – Firemaw / Ebonroc / Flamegor: Platzhalter „Tier-2-Set: Hände“ → durch echte Gegenstände ersetzt
- Pechschwingenhort – Chromaggus: Platzhalter „Tier-2-Set: Schultern“ → durch echte Gegenstände ersetzt
- Pechschwingenhort – Nefarian: Platzhalter „Tier-2-Set: Brust“ → durch echte Gegenstände ersetzt
- Naxxramas – Kel'Thuzad: Platzhalter „Phylactery of Kel'Thuzad“ → durch echte Gegenstände ersetzt
- Naxxramas – Kel'Thuzad: „Splinter of Atiesh“ droppt laut Datenbank bei **Thaddius** → hier entfernt

## Quest startet durch Gegenstand/Objekt (5)
- The Unsent Letter: „Brief von VanCleef“ → **Ein nie abgeschickter Brief** (An Unsent Letter)
- The Platinum Discs: „Lore Keeper of Norgannon“ → **Die Scheiben von Norgannon** (The Discs of Norgannon)
- The Heart of Hakkar: „Molthor“ → **Herz von Hakkar** (Heart of Hakkar)
- The Fall of Ossirian: „Head of Ossirian“ → **Kopf von Ossirian dem Narbenlosen** (Head of Ossirian the Unscarred)
- The Fall of Kel'Thuzad: „Phylactery of Kel'Thuzad“ → **Kel'Thuzads Phylakterium** (The Phylactery of Kel'Thuzad)

## Dungeon-Namen (6)
- Die Tiefschwarze Grotte → offiziell: **Tiefschwarze Grotte** (Blackfathom Deeps)
- Der Kral der Klingenhauer → offiziell: **Kral der Klingenhauer** (Razorfen Kraul)
- Die Hügel der Klingenhauer → offiziell: **Hügel der Klingenhauer** (Razorfen Downs)
- Der Versunkene Tempel → offiziell: **Versunkener Tempel** (Sunken Temple)
- Die Schwarzfelsspitze → offiziell: **Schwarzfelsspitze** (Blackrock Spire)
- Der Geschmolzene Kern → offiziell: **Geschmolzener Kern** (Molten Core)

## Belohnungen korrigiert (6)
- Knowledge in the Deeps: „Gerrig's Ring (Wahl)“ ist keine Belohnung dieser Quest
- Compendium of the Fallen: „Vanquisher's Sword“ ist keine Belohnung dieser Quest
- Compendium of the Fallen: „Horizon Choker“ ist keine Belohnung dieser Quest
- Dead Man's Plea: „Wichtiger Teil der Dungeon-Set-Upgrade-Reihe“ ist keine Belohnung dieser Quest
- Unfinished Gordok Business: „Ruf-Buff (Fengus' Ferocity etc.)“ ist keine Belohnung dieser Quest
- The Heart of Hakkar: „Zandalarian Hero Badge/Charm/Medallion; Buff für alle“ ist keine Belohnung dieser Quest

## Fraktion korrigiert (3)
- A Fine Mess: A → B
- Uldaman Reagent Run: H → B
- Lethtendris's Web: A → B

## Drops ohne Quelle in der Datenbank (behalten, markiert) (2)
- Weltboss – Azuregos: Mature Blue Dragon Sinew
- Weltboss – Drachen des Albtraums: Hammer of Bestial Fury

