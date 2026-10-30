import styles from "@/features/landing/StoreCta.module.css";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/features/landing/landingData";

/**
 * A download button that points at the right store for the device.
 *
 * Both links are rendered and CSS hides the wrong one, keyed off the data-os attribute that
 * app/layout.tsx stamps on <html> before the first paint — "apple" covering iPhone, iPad and
 * Mac alike. That combination is what makes the switch instant:
 *   - deciding on the client inside an effect would paint the wrong store first and swap,
 *   - deciding on the server from the User-Agent would make this page render per request and
 *     drop out of the CDN.
 * The pre-paint script does neither, and if scripting is off the Play Store link is what shows.
 */

const PlayStoreIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    viewBox="0 0 512 512"
    aria-hidden="true"
    width={size}
    height={size}
    fill="currentColor"
  >
    <path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l265.6-265.6L47 0zm425.2 225.6-58.9-34.1-65.7 65.7 65.7 65.7 60.1-34.1c17.9-10.4 17.9-36.8-1.2-47.2zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
  </svg>
);

const AppleIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    viewBox="0 0 384 512"
    aria-hidden="true"
    width={size}
    height={size}
    fill="currentColor"
  >
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

type Props = {
  /** The visual class for the button; applied identically to both links. */
  className?: string;
  iconSize?: number;
  children: React.ReactNode;
};

export default function StoreCta({
  className = "",
  iconSize = 16,
  children,
}: Props) {
  return (
    <>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} ${styles.androidOnly}`}
      >
        <PlayStoreIcon size={iconSize} />
        {children}
      </a>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} ${styles.appleOnly}`}
      >
        <AppleIcon size={iconSize} />
        {children}
      </a>
    </>
  );
}
