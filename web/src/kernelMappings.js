export const KERNEL_MAPPING_REVIEW = {
  cadence: "monthly",
  reviewIssueTitle: "Review kernel mappings",
  docsPath: "docs/kernel-mappings.md",
  sources: {
    unraid: ["https://docs.unraid.net/unraid-os/release-notes/"],
    ubuntu: [
      "https://ubuntu.com/kernel/lifecycle",
      "https://packages.ubuntu.com/search?keywords=linux-image-generic",
    ],
  },
};

export const UNRAID_KERNEL_MAPPINGS = {
  exact: {
    "5.10.19": "Unraid OS 6.9.0",
    "5.10.21": "Unraid OS 6.9.1",
    "5.10.28": "Unraid OS 6.9.2",
    "5.15.40": "Unraid OS 6.10.x",
    "5.15.43": "Unraid OS 6.10.2",
    "5.15.46": "Unraid OS 6.10.3",
    "5.19.9": "Unraid OS 6.11.0",
    "5.19.14": "Unraid OS 6.11.1",
    "5.19.17": "Unraid OS 6.11.x",
    "6.1.33": "Unraid OS 6.12.0",
    "6.1.34": "Unraid OS 6.12.1",
    "6.1.36": "Unraid OS 6.12.2",
    "6.1.38": "Unraid OS 6.12.3",
    "6.1.49": "Unraid OS 6.12.4",
    "6.1.63": "Unraid OS 6.12.5",
    "6.1.64": "Unraid OS 6.12.6",
    "6.1.74": "Unraid OS 6.12.8",
    "6.1.79": "Unraid OS 6.12.10",
    "6.1.82": "Unraid OS 6.12.9",
    "6.1.99": "Unraid OS 6.12.11",
    "6.1.103": "Unraid OS 6.12.12",
    "6.1.106": "Unraid OS 6.12.13",
    "6.1.118": "Unraid OS 6.12.14",
    "6.1.126": "Unraid OS 6.12.15",
    "6.6.68": "Unraid OS 7.0.0",
    "6.6.78": "Unraid OS 7.0.1",
    "6.12.24": "Unraid OS 7.1.x",
    "6.12.54": "Unraid OS 7.2.x",
    "6.12.85": "Unraid OS 7.2.5",
    "6.12.87": "Unraid OS 7.2.6",
    "6.18.28": "Unraid OS 7.3.0",
  },
  series: {
    "4.19": "Unraid OS 6.8.x",
    "5.10": "Unraid OS 6.9.x",
    "5.15": "Unraid OS 6.10.x",
    "5.19": "Unraid OS 6.11.x",
    "6.1": "Unraid OS 6.12.x",
    "6.6": "Unraid OS 7.0.x",
    "6.12": "Unraid OS 7.1.x-7.2.x",
    "6.18": "Unraid OS 7.3.x",
  },
};

export const UBUNTU_KERNEL_MAPPINGS = {
  exact: {},
  series: {
    "5.4": "Ubuntu 20.04 LTS",
    "5.15": "Ubuntu 22.04 LTS",
    "6.2": "Ubuntu 22.04 LTS",
    "6.5": "Ubuntu 22.04 LTS",
    "6.8": "Ubuntu 24.04 LTS",
  },
};
