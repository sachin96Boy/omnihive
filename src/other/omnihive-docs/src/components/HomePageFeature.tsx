/// <reference path="../../declarations.d.ts" />

import useBaseUrl from "@docusaurus/useBaseUrl";
import React from "react";
import ThemedImage from "./ThemedImage";
import styles from "./HomePageFeature.module.scss";

export interface FeatureProps {
    lightImageSource: string;
    darkImageSource: string;
    title: string;
    description: React.ReactElement;
}

const Feature: React.FC<FeatureProps> = ({
    lightImageSource,
    darkImageSource,
    title,
    description,
}): React.ReactElement => {
    const lightImage = useBaseUrl(lightImageSource);
    const darkImage = useBaseUrl(darkImageSource);

    return (
        <div className={`col col--4 ${styles.feature}`}>
            <div className="text--center">
                <ThemedImage
                    className={`${styles.featureImage}`}
                    lightimagesource={lightImage}
                    darkimagesource={darkImage}
                    alt={title}
                />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
};

export default Feature;
