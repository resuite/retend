import { Await } from "retend";
import { Link, Outlet } from "retend/router";

export function MainLayout() {
	return (
		<div class="mx-auto max-w-[1140px] px-6 md:px-10">
			<Await>
				<nav class="flex items-center justify-between py-12">
					<Link
						class="text-xl tracking-tight text-fg"
						href="/"
						aria-label="Retend home"
					>
						retend
					</Link>
					<div class="flex gap-10" aria-label="Primary">
						<Link
							class="text-[0.95rem] text-fg-muted hover:text-brand"
							href="/features"
						>
							Features
						</Link>
						<Link
							class="text-[0.95rem] text-fg-muted hover:text-brand"
							href="/quickstart"
						>
							Quickstart
						</Link>
						<a
							class="text-[0.95rem] text-fg-muted hover:text-brand"
							href="https://github.com/adebola-io/retend"
							target="_blank"
							rel="noreferrer"
						>
							Github
						</a>
					</div>
				</nav>

				<main class="flex flex-col gap-[140px] pb-30">
					<Outlet />
				</main>

				<footer class="flex justify-between border-t border-border pt-20 pb-10 text-[0.9rem] text-fg-muted">
					<p>© 2026 Retend</p>
					<a
						href="https://github.com/adebola-io/retend"
						target="_blank"
						rel="noreferrer"
					>
						Repository
					</a>
				</footer>
			</Await>
		</div>
	);
}
