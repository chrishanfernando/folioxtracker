# Product Documentation

This folder collects product-management artefacts written *on top of* the portfolio tracker codebase in this repo. It is not a launched product — it's a single-user app I built for myself. The artefacts demonstrate how I think when I am the person responsible for product direction, scope, and trade-offs.

I'm a senior systems engineer moving toward TPM / PM roles. The codebase shows the engineering judgement; this folder shows the product judgement, applied to the same problem end-to-end. Treat each document as a worked example of one PM craft: discovery, prioritisation, PRD writing, GTM, instrumentation, decision-making.

## What this is, and what it isn't

| It is | It isn't |
| --- | --- |
| A working app I use every day | A product with paying users |
| Real engineering decisions, written up honestly | A pitch for a startup |
| PM-craft artefacts grounded in a real codebase | A claim that any of this has been validated at scale |
| Hypotheses I'd test if I ran this commercially | Validated market truth |

Where a document is hypothetical (e.g. GTM, metrics for hypothetical users), it is labelled as such at the top.

## Contents

| # | Document | Question it answers |
| --- | --- | --- |
| 01 | [Discovery](./01-discovery.md) | Who has the problem, what is the problem, how would I know if I'm wrong? |
| 02 | [Competitive analysis](./02-competitive-analysis.md) | What's already in the market? Where's the gap? |
| 03 | [Product strategy](./03-product-strategy.md) | Should this be a product? What kind? |
| 04 | [GTM strategy](./04-gtm-strategy.md) | If yes, how would I take it to market? |
| 05 | [PRD: Tax-lot tracking & CGT](./05-prd-tax-lot-tracking.md) | A worked PRD for one meaty feature decision |
| 06 | [Metrics & instrumentation plan](./06-metrics-plan.md) | What I'd measure if this had real users |
| 07 | [Scope cuts](./07-scope-cuts.md) | What I deliberately said no to, and why |
| 08 | [Roadmap](./08-roadmap.md) | Where I'd take it next, sized honestly |

Architectural decisions live in [`../decisions/`](../decisions/) as ADRs.

## Reading order for hiring managers

If you have 10 minutes and want a sense of how I think: read **01 (discovery)**, **05 (PRD)**, and any one ADR. Those three cover problem framing, PRD craft, and engineering trade-offs.

If you have 30 minutes: add **03 (strategy)**, **04 (GTM)**, **06 (metrics)**.

The rest is depth.

## Honest caveats

- The user research is N=1 (me). Section 01 says so plainly and explains how I'd extend to N=20 in a week. Pretending to have validated demand from a single-user side project would be the wrong signal.
- The GTM is a thought experiment, not a launch plan. It's there because the rejection feedback I'm working through ("more time in PM roles, more consumer focus") told me I needed to demonstrate that thinking explicitly.
- Numbers and timelines are sized to a 5-hour-a-week side-project velocity, not full-time engineering capacity.

If you spot something that reads as theatre rather than craft, that's a bug — please tell me.
