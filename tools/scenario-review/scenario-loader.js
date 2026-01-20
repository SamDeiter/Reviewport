/**
 * Scenario Loader for Review Tool
 * Dynamically loads all scenario JS files
 */

(function () {
  window.SCENARIOS = window.SCENARIOS || {};

  // List of all scenario files to load
  const scenarioFiles = [
    // game_dev
    "scenarios/game_dev/ComponentMobilityBlock.js",
    "scenarios/game_dev/DestroyActorStopsExecutionFlow.js",
    "scenarios/game_dev/LockedCinematicCleanup.js",
    "scenarios/game_dev/SecurityDoorLogicGap.js",
    "scenarios/game_dev/SequencerLightRestoreStateIssue.js",
    "scenarios/game_dev/VaultSequenceLockup.js",
    "scenarios/game_dev/InputActionNotResponding.js",
    "scenarios/game_dev/AIBehaviorTreeBlackboardIssue.js",
    "scenarios/game_dev/ReplicationVariableNotSyncing.js",
    // look_dev
    "scenarios/look_dev/BlackMaterialDueToEmissiveMiswiring.js",
    "scenarios/look_dev/BlackMetallicObject.js",
    "scenarios/look_dev/DecalTextureAlphaMaskFailure.js",
    "scenarios/look_dev/MaterialNotRenderingInPIE.js",
    "scenarios/look_dev/TextureBlurryDespiteHighRes.js",
    "scenarios/look_dev/LumenReflectionIncorrectColor.js",
    "scenarios/look_dev/SubstrateMaterialLayerConflict.js",
    "scenarios/look_dev/NaniteVSMIntegrationIssue.js",
    "scenarios/look_dev/VirtualShadowMapArtifacts.js",
    // tech_art
    "scenarios/tech_art/DanglingAssetRedirectors.js",
    "scenarios/tech_art/MaterialParameterAndAnimJitter.js",
    "scenarios/tech_art/MismatchedSkeletonReference.js",
    "scenarios/tech_art/RedirectorAndBulkLoadConflict.js",
    "scenarios/tech_art/generator.js",
    "scenarios/tech_art/AnimationRetargetBoneNaming.js",
    "scenarios/tech_art/BlendSpaceFootSliding.js",
    "scenarios/tech_art/ControlRigFootIKGroundPenetration.js",
    "scenarios/tech_art/LiveLinkBodyTrackingJitter.js",
    "scenarios/tech_art/PhysicsAssetRagdollExplosion.js",
    // vfx
    "scenarios/vfx/nanite_wpo_failure.js",
    "scenarios/vfx/VolumetricShadowingPerformance.js",
    "scenarios/vfx/NiagaraEmitterNotSpawning.js",
    "scenarios/vfx/SequencerCameraCutNotPlaying.js",
    "scenarios/vfx/NiagaraDataInterfaceBindingError.js",
    "scenarios/vfx/NiagaraGPUSimulationFallback.js",
    "scenarios/vfx/NiagaraRibbonTrailGaps.js",
    "scenarios/vfx/SequencerAudioSyncDrift.js",
    // worldbuilding
    "scenarios/worldbuilding/ForcedDataLayerUnload.js",
    "scenarios/worldbuilding/WorldPartitionDeepDive.js",
    "scenarios/worldbuilding/WorldPartitionActorNotLoading.js",
    "scenarios/worldbuilding/WorldPartitionCellBoundaryPopIn.js",
    "scenarios/worldbuilding/HLODNotGenerating.js",
    "scenarios/worldbuilding/LandscapeStreamingHoles.js",
    "scenarios/worldbuilding/LevelInstanceEditingBlocked.js",
    "scenarios/worldbuilding/OneFilePerActorMergeConflict.js",
    "scenarios/worldbuilding/PCGGraphNotGenerating.js",
  ];

  let loaded = 0;
  const total = scenarioFiles.length;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "../../" + src;
      script.onload = () => {
        loaded++;
        updateLoadingProgress();
        resolve();
      };
      script.onerror = () => {
        loaded++;
        updateLoadingProgress();
        resolve(); // Don't reject, just continue
      };
      document.head.appendChild(script);
    });
  }

  function updateLoadingProgress() {
    const pct = Math.round((loaded / total) * 100);
    const countEl = document.getElementById("scenario-count");
    if (countEl) countEl.textContent = `${loaded}/${total}`;
  }

  // Load all scenarios
  window.loadAllScenarios = async function () {
    console.log(`Loading ${total} scenario files...`);

    // Load in batches to avoid overwhelming the browser
    const batchSize = 10;
    for (let i = 0; i < scenarioFiles.length; i += batchSize) {
      const batch = scenarioFiles.slice(i, i + batchSize);
      await Promise.all(batch.map(loadScript));
    }

    console.log(`Loaded ${Object.keys(window.SCENARIOS).length} scenarios`);

    // Trigger the main app to render
    if (typeof loadScenarios === "function") {
      loadScenarios();
    }
  };

  // Auto-load when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.loadAllScenarios);
  } else {
    window.loadAllScenarios();
  }
})();
