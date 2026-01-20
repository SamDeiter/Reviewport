/**
 * UE5 Scenario Tracker - Application Configuration
 *
 * This module provides centralized configuration for the application.
 * Sensitive values like passwords should be set via environment variables
 * or server-side configuration in production.
 */

window.APP_CONFIG = {
  // Debug mode password - In production, this should be set server-side
  // or disabled entirely. Default is secure placeholder.
  DEBUG_PASSWORD: "CHANGEME",

  // Timer settings
  TOTAL_TEST_TIME_SECONDS: 30 * 60, // 30 minutes
  LOW_TIME_WARNING_SECONDS: 5 * 60, // 5 minutes warning

  // Scoring
  PASS_THRESHOLD: 0.8, // 80% to pass

  // Time costs per choice type (in hours)
  TIME_COSTS: {
    correct: 0.5,
    partial: 1.0,
    misguided: 1.5,
    wrong: 2.0,
  },

  // Feature flags
  FEATURES: {
    enableDebugMode: true,
    enableScormTracking: true,
    showTimerByDefault: true,
  },

  // Time budget thresholds for color coding
  TIME_BUDGET_THRESHOLDS: {
    excellent: 1.2, // <= 120% of budget = green
    acceptable: 1.4, // <= 140% of budget = yellow
    // > 140% = red
  },

  // UE5 Connection settings
  UE5_CONNECTION: {
    retryDelayMs: 30000, // 30 seconds before retrying
    timeoutMs: 500, // 500ms timeout for faster failure
  },
};

// Allow environment override (for local development)
// In production, this could be replaced with server-side values
if (typeof process !== "undefined" && process.env) {
  if (process.env.DEBUG_PASSWORD) {
    window.APP_CONFIG.DEBUG_PASSWORD = process.env.DEBUG_PASSWORD;
  }
}

console.log("[Config] Application configuration loaded");

// Handle URL parameter for direct scenario launch
(function () {
  const params = new URLSearchParams(window.location.search);
  const scenarioId = params.get("scenario");

  if (scenarioId) {
    console.log(`[Config] Auto-start scenario requested: ${scenarioId}`);
    window.APP_CONFIG.AUTO_START_SCENARIO = scenarioId;

    // Function to force-start the scenario
    function forceStartScenario() {
      const scenario = window.SCENARIOS?.[scenarioId];
      if (!scenario || !window.ScenarioEngine) {
        console.warn(`[Config] Scenario or engine not ready, retrying...`);
        return false;
      }

      console.log(`[Config] Force-starting scenario: ${scenarioId}`);

      // Hide placeholder and show ticket content
      const placeholder = document.getElementById("ticket-placeholder");
      const ticketContent = document.getElementById("ticket-content");
      if (placeholder) placeholder.classList.add("hidden");
      if (ticketContent) {
        ticketContent.classList.remove("hidden");
        ticketContent.classList.add("flex");
      }

      // Set ticket title and description
      const titleEl = document.getElementById("ticket-title");
      const descEl = document.getElementById("ticket-description");
      if (titleEl) titleEl.textContent = scenario.meta?.title || scenarioId;
      if (descEl) descEl.textContent = scenario.meta?.description || "";

      // Start the scenario
      window.ScenarioEngine.load(scenarioId, scenario);

      // Render first step if StepRenderer exists
      if (window.StepRenderer) {
        const step = window.ScenarioEngine.getCurrentStep();
        if (step && step.id) {
          const container = document.getElementById("ticket-step-content");
          if (container) {
            // StepRenderer.render(scenarioId, stepId, options)
            window.StepRenderer.render(scenarioId, step.id, {
              container: container,
              onChoiceClick: (btn) => {
                // Handle choice click by going to next step
                const nextStepId = btn.dataset.choiceNext;
                if (nextStepId === "end") {
                  console.log("[Config] Scenario completed");
                  return;
                }
                if (nextStepId && window.ScenarioEngine.getCurrentStep) {
                  window.ScenarioEngine.makeChoice(
                    parseInt(btn.dataset.originalIndex) || 0,
                  );
                  const newStep = window.ScenarioEngine.getCurrentStep();
                  if (newStep && newStep.id) {
                    window.StepRenderer.render(scenarioId, newStep.id, {
                      container: container,
                      onChoiceClick: arguments.callee,
                    });
                  }
                }
              },
            });
          }
        }
      }
      return true;
    }

    // Wait for app to fully initialize, then override with our scenario
    window.addEventListener("load", function () {
      // Try multiple times with increasing delay to beat the app's init
      setTimeout(forceStartScenario, 100);
      setTimeout(forceStartScenario, 500);
      setTimeout(forceStartScenario, 1500);
      setTimeout(forceStartScenario, 3000);
    });
  }
})();

// Resume/Bookmark feature - check for saved progress on load
(function () {
  // Skip if URL param is forcing a specific scenario
  if (window.APP_CONFIG?.AUTO_START_SCENARIO) return;

  window.addEventListener("load", function () {
    setTimeout(function () {
      // Check if StateManager is available
      if (!window.StateManager) return;

      const active = window.StateManager.getActiveScenario();
      if (active.scenarioId && active.stepId) {
        const scenario = window.SCENARIOS?.[active.scenarioId];
        if (!scenario) return;

        const scenarioTitle = scenario.meta?.title || active.scenarioId;

        // Show resume prompt
        const resume = confirm(
          `Welcome back!\n\nYou were working on:\n"${scenarioTitle}"\n\nWould you like to continue where you left off?\n\nClick OK to resume, or Cancel to start fresh.`,
        );

        if (resume) {
          console.log(
            `[Config] Resuming scenario: ${active.scenarioId} at step ${active.stepId}`,
          );

          // Hide placeholder and show ticket content
          const placeholder = document.getElementById("ticket-placeholder");
          const ticketContent = document.getElementById("ticket-content");
          if (placeholder) placeholder.classList.add("hidden");
          if (ticketContent) {
            ticketContent.classList.remove("hidden");
            ticketContent.classList.add("flex");
          }

          // Set ticket title and description
          const titleEl = document.getElementById("ticket-title");
          const descEl = document.getElementById("ticket-description");
          if (titleEl)
            titleEl.textContent = scenario.meta?.title || active.scenarioId;
          if (descEl) descEl.textContent = scenario.meta?.description || "";

          // Load scenario and go to the saved step
          window.ScenarioEngine.load(active.scenarioId, scenario);
          window.ScenarioEngine._currentStepId = active.stepId;

          // Render the saved step
          if (window.StepRenderer) {
            const container = document.getElementById("ticket-step-content");
            if (container) {
              window.StepRenderer.render(active.scenarioId, active.stepId, {
                container: container,
                onChoiceClick: function handleChoice(btn) {
                  const nextStepId = btn.dataset.choiceNext;
                  if (nextStepId === "end") {
                    console.log("[Config] Scenario completed");
                    window.StateManager.clearCurrentScenario();
                    return;
                  }
                  if (nextStepId) {
                    window.ScenarioEngine.makeChoice(
                      parseInt(btn.dataset.originalIndex) || 0,
                    );
                    const newStep = window.ScenarioEngine.getCurrentStep();
                    if (newStep && newStep.id) {
                      window.StateManager.setCurrentScenario(
                        active.scenarioId,
                        newStep.id,
                      );
                      window.StepRenderer.render(
                        active.scenarioId,
                        newStep.id,
                        {
                          container: container,
                          onChoiceClick: handleChoice,
                        },
                      );
                    }
                  }
                },
              });
            }
          }
        } else {
          // User wants to start fresh - clear saved state
          console.log("[Config] User chose to start fresh");
          window.StateManager.clearCurrentScenario();
        }
      }
    }, 1000); // Wait for app to fully initialize
  });
})();

// Review Mode Integration
(function () {
  const params = new URLSearchParams(window.location.search);
  const isReviewMode = params.get("mode") === "review";

  if (isReviewMode) {
    window.addEventListener("load", function () {
      setTimeout(async function () {
        if (!window.ReviewCore || !window.MANIFEST) return;

        console.log("[Config] Review Mode enabled. Initializing SDK...");

        // 1. Map Manifest Scenarios to Review SDK Items
        const reviewItems = [];
        const categories = window.MANIFEST.categories || {};

        Object.keys(categories).forEach((catKey) => {
          const category = categories[catKey];
          category.scenarios.forEach((scenarioId) => {
            const scenario = window.SCENARIOS?.[scenarioId];
            reviewItems.push({
              id: scenarioId,
              title: scenario?.meta?.title || scenarioId,
              category: category.name,
            });
          });
        });

        // 2. Initialize Core with host-specific overrides
        const reviewCore = new window.ReviewCore({
          appId: "ue5-scenario-tracker",
          items: reviewItems,
          storage: new window.ReviewStorage.LocalStorage(),

          // Mapper: Bridge SDK item selection to Scenario Tracker engine
          onShowItem: (item) => {
            console.log(`[Config] SDK requested item: ${item.id}`);

            // Re-use existing scenario loading logic
            const scenario = window.SCENARIOS?.[item.id];
            if (scenario) {
              const placeholder = document.getElementById("ticket-placeholder");
              const ticketContent = document.getElementById("ticket-content");
              if (placeholder) placeholder.classList.add("hidden");
              if (ticketContent) {
                ticketContent.classList.remove("hidden");
                ticketContent.classList.add("flex");
              }

              const titleEl = document.getElementById("ticket-title");
              const descEl = document.getElementById("ticket-description");
              if (titleEl)
                titleEl.textContent = scenario.meta?.title || item.id;
              if (descEl) descEl.textContent = scenario.meta?.description || "";

              window.ScenarioEngine.load(item.id, scenario);
              const step = window.ScenarioEngine.getCurrentStep();
              if (step && window.StepRenderer) {
                const container = document.getElementById(
                  "ticket-step-content",
                );
                window.StepRenderer.render(item.id, step.id, {
                  container: container,
                  onChoiceClick: function handleReviewChoice(btn) {
                    // Logic same as standard auto-start for navigation
                    const nextStepId = btn.dataset.choiceNext;
                    if (nextStepId === "end") return;
                    window.ScenarioEngine.makeChoice(
                      parseInt(btn.dataset.originalIndex) || 0,
                    );
                    const newStep = window.ScenarioEngine.getCurrentStep();
                    if (newStep && newStep.id) {
                      window.StepRenderer.render(item.id, newStep.id, {
                        container: container,
                        onChoiceClick: handleReviewChoice,
                      });
                    }
                  },
                });
              }
            }
          },
        });

        // 3. Setup UI
        const ui = window.ReviewUI.createBar(reviewCore);
        reviewCore.setUI(ui);

        // 4. Start SDK
        await reviewCore.init();
      }, 1500); // Delay to let Manifest/Scenarios be ready
    });
  }
})();
