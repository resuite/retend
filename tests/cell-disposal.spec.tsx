import { describe, it, expect, vi } from "vitest";
import { Cell } from "retend";
import { If } from "retend";
import { useSetupEffect, runPendingSetupEffects } from "retend";
import { getGlobalContext } from "retend/context";
import { browserSetup } from "./setup.ts";

describe("Cell disposal in control flow", () => {
	browserSetup();

	it("should stop cell listeners from triggering when higher-level control flow branches are disposed", async () => {
		const { window } = getGlobalContext();
		const outerShow = Cell.source(true);
		const innerShow = Cell.source(true);
		const sourceCell = Cell.source("initial");
		const listener = vi.fn();

		const ComponentWithListener = () => {
			useSetupEffect(() => {
				const unsubscribe = sourceCell.listen(listener);
				return unsubscribe;
			});
			return <div>Component</div>;
		};

		const result = (
			<div>
				{If(outerShow, () => (
					<div>
						{If(innerShow, () => (
							<ComponentWithListener />
						))}
					</div>
				))}
			</div>
		) as HTMLElement;

		window.document.body.append(result);
		await runPendingSetupEffects();

		// Initially, both branches are shown, so changing sourceCell should trigger listener
		sourceCell.set("updated");
		expect(listener).toHaveBeenCalledTimes(1);

		// Dispose the outer branch (this should dispose the entire subtree including the inner If)
		outerShow.set(false);
		await runPendingSetupEffects();

		// Reset the mock
		listener.mockClear();

		// Now changing sourceCell should not trigger the listener since the outer branch is disposed
		sourceCell.set("final");
		expect(listener).not.toHaveBeenCalled();
	});
});
