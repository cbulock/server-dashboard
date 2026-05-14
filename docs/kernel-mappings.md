# Kernel mapping maintenance

This dashboard turns SNMP `sysDescr` kernel strings into friendlier Unraid and Ubuntu labels in `/web/src/kernelMappings.js`.

## Review cadence

- Review the mappings once per month.
- Review them immediately when the UI shows a raw kernel string instead of a friendly label for an Unraid or Ubuntu host.

## Update checklist

1. Review the latest Unraid release notes and record any new kernel-to-release matches in `UNRAID_KERNEL_MAPPINGS.exact`.
2. Adjust `UNRAID_KERNEL_MAPPINGS.series` only when a new Unraid release family starts using a new kernel series.
3. Review the current Ubuntu kernel lifecycle and generic kernel packages.
4. Update `UBUNTU_KERNEL_MAPPINGS.series` when supported Ubuntu GA or HWE kernel families change.
5. Keep Ubuntu labels at the kernel-family level unless the upstream data clearly ties a kernel to a single Ubuntu release.
6. Build the frontend with `cd web && npm run build` to verify the mapping module still compiles.

## Upstream sources

- Unraid release notes: https://docs.unraid.net/unraid-os/release-notes/
- Ubuntu kernel lifecycle: https://ubuntu.com/kernel/lifecycle
- Ubuntu generic kernel packages: https://packages.ubuntu.com/search?keywords=linux-image-generic

## Operating rule

Prefer exact Unraid matches and family-level Ubuntu matches. If a kernel cannot be mapped confidently, leave the raw `sysDescr` visible instead of guessing.
