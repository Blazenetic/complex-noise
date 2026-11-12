# Playback confidence campaign handover

## Authority and scope

The user authorised three bounded units for review, with no new PR merges or
release. The parent liaison owns final review, old PR merges and this record
after the recovery and timer implementation returns. No deployment, dependency
or build changes, sound/default changes, or unrelated cleanup is authorised.

## Units

- EQ persistence: PR #54, `codex/playback-confidence-eq`, separate parent owner;
  it is now the base of the #54 → #55 → #56 review stack.
- Source failure recovery: `codex/playback-confidence-recovery`; candidate
  starts before old source retirement, failures roll back and allow retry.
- Timer status: `codex/playback-confidence-timer-status`, stacked on recovery;
  preserve deadlines and prioritise interruptions and recovery status.

## Source and gate

Started from main `d986166` and merged mobile branch candidate
`34904962ada3edf0c70c8d1725863de73ffa8fb0`, including lifecycle candidate
`f46a3a205050d11cae581dce0add80ee16f724d5`. PRs #49–#53 are merged; final main `7ede410a6808aac8bad00fa15071e022e25a4a07`
was merged into recovery. Their changes are no longer in the review diff. The acceptance
gate is focused lifecycle/browser coverage, `npm run check` and
`git diff --check` on each final head. Independent review and CI are parent
responsibilities; the user retains authority over the new merges. Browser and
fake-context tests do not establish physical output or overnight reliability.

## Next action

This is the recovery checkpoint. The newer version of this same record on
PR #56 is the campaign closeout authority; read that version before continuing.

Review each PR against its actual base and head, including the stacked merge
order, and reconcile the record after the implementation worker returns.
