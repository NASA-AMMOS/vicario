package jpl.mipl.io.plugins;

import java.awt.color.ColorSpace;

/**
 * A dummy ColorSpace that accepts any number of components.
 * Replacement for com.sun.imageio.plugins.common.BogusColorSpace
 * which is not accessible under the Java module system (Java 9+).
 */
class BogusColorSpace extends ColorSpace {

    private final int numComponents;

    BogusColorSpace(int numComponents) {
        super(13, numComponents); // 13 = unspecified type, matches original JDK BogusColorSpace
        this.numComponents = numComponents;
    }

    @Override
    public float[] toRGB(float[] colorvalue) {
        float[] rgb = new float[3];
        for (int i = 0; i < Math.min(3, numComponents); i++) {
            rgb[i] = colorvalue[i];
        }
        return rgb;
    }

    @Override
    public float[] fromRGB(float[] rgbvalue) {
        float[] color = new float[numComponents];
        for (int i = 0; i < Math.min(3, numComponents); i++) {
            color[i] = rgbvalue[i];
        }
        return color;
    }

    @Override
    public float[] toCIEXYZ(float[] colorvalue) {
        return toRGB(colorvalue);
    }

    @Override
    public float[] fromCIEXYZ(float[] colorvalue) {
        return fromRGB(colorvalue);
    }
}
