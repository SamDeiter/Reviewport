// Initialize the global SCENARIOS object
window.SCENARIOS = window.SCENARIOS || {};

/**
 * Scenario Manifest - Organized by Learning Area
 *
 * Categories:
 * - worldbuilding: Large-scale environments, streaming, spatial organization
 * - game_dev: Game mechanics, logic, physics, interactive systems
 * - look_dev: Visual fidelity, materials, lighting, rendering
 * - tech_art: Asset pipeline, technical setup, cross-discipline workflows
 * - vfx: Visual effects, cinematics, camera work
 */

const MANIFEST = {
  categories: {
    worldbuilding: {
      name: "Worldbuilding",
      description:
        "Large-scale environment creation, streaming, and spatial organization",
      scenarios: [
        "worldbuilding/WorldPartitionDeepDive",
        "worldbuilding/ForcedDataLayerUnload",
        "worldbuilding/WorldPartitionActorNotLoading",
        "worldbuilding/WorldPartitionCellBoundaryPopIn",
        "worldbuilding/HLODNotGenerating",
        "worldbuilding/LandscapeStreamingHoles",
        "worldbuilding/LevelInstanceEditingBlocked",
        "worldbuilding/OneFilePerActorMergeConflict",
        "worldbuilding/PCGGraphNotGenerating",
      ],
    },
    game_dev: {
      name: "Game Dev",
      description:
        "Game mechanics, logic, physics simulation, and interactive systems",
      scenarios: [
        "game_dev/ComponentMobilityBlock",
        "game_dev/DestroyActorStopsExecutionFlow",
        "game_dev/SecurityDoorLogicGap",
        "game_dev/VaultSequenceLockup",
        "game_dev/LockedCinematicCleanup",
        "game_dev/SequencerLightRestoreStateIssue",
        "game_dev/InputActionNotResponding",
        "game_dev/AIBehaviorTreeBlackboardIssue",
        "game_dev/ReplicationVariableNotSyncing",
      ],
    },
    look_dev: {
      name: "Look Dev",
      description:
        "Visual fidelity, materials, lighting, and rendering quality",
      scenarios: [
        "look_dev/BlackMetallicObject",
        "look_dev/BlackMaterialDueToEmissiveMiswiring",
        "look_dev/DecalTextureAlphaMaskFailure",
        "look_dev/MaterialNotRenderingInPIE",
        "look_dev/TextureBlurryDespiteHighRes",
        "look_dev/LumenReflectionIncorrectColor",
        "look_dev/SubstrateMaterialLayerConflict",
        "look_dev/NaniteVSMIntegrationIssue",
        "look_dev/VirtualShadowMapArtifacts",
      ],
    },
    tech_art: {
      name: "Tech Art",
      description:
        "Asset pipeline, technical setup, and cross-discipline workflows",
      scenarios: [
        "tech_art/DanglingAssetRedirectors",
        "tech_art/MismatchedSkeletonReference",
        "tech_art/RedirectorAndBulkLoadConflict",
        "tech_art/MaterialParameterAndAnimJitter",
        "tech_art/generator",
        "tech_art/AnimationRetargetBoneNaming",
        "tech_art/BlendSpaceFootSliding",
        "tech_art/ControlRigFootIKGroundPenetration",
        "tech_art/LiveLinkBodyTrackingJitter",
        "tech_art/PhysicsAssetRagdollExplosion",
      ],
    },
    vfx: {
      name: "VFX",
      description: "Visual effects, cinematics, and visual storytelling",
      scenarios: [
        "vfx/VolumetricShadowingPerformance",
        "vfx/nanite_wpo_failure",
        "vfx/NiagaraEmitterNotSpawning",
        "vfx/SequencerCameraCutNotPlaying",
        "vfx/NiagaraDataInterfaceBindingError",
        "vfx/NiagaraGPUSimulationFallback",
        "vfx/NiagaraRibbonTrailGaps",
        "vfx/SequencerAudioSyncDrift",
        "vfx/CascadeToNiagaraMigration",
      ],
    },
  },

  // Flat list of all scenario paths
  getAllScenarios() {
    const all = [];
    for (const category of Object.values(this.categories)) {
      all.push(...category.scenarios);
    }
    return all;
  },

  // Get scenarios by category
  getByCategory(categoryKey) {
    return this.categories[categoryKey]?.scenarios || [];
  },

  // Get category info
  getCategoryInfo(categoryKey) {
    return this.categories[categoryKey] || null;
  },
};

// Expose MANIFEST globally
window.MANIFEST = MANIFEST;

if (typeof module !== "undefined" && module.exports) {
  module.exports = MANIFEST;
}
