import Image from "next/image";
import {
  Boxes,
  ChartNoAxesCombined,
  Landmark,
  ScanSearch,
  ShieldCheck,
  Store,
  Truck,
  WalletCards,
  Wheat,
} from "lucide-react";
import SiteChrome from "@/features/landing/SiteChrome";
import { SiteFooter } from "@/features/landing/LandingPage";
import styles from "@/features/landing/LandingPage.module.css";

const PRODUCT_GROUPS = [
  {
    category: "Risk & Insurance",
    products: [
      {
        name: "AI-Powered Quality Assessment",
        description:
          "We are building AI-powered quality assessment for farmers, mandis, traders and large FPOs—using multiple layers of intelligence to make commodity transactions more accurate, transparent and trusted.",
        icon: ScanSearch,
      },
      {
        name: "Smart Commodity Management",
        description:
          "Manage commodities, inventory, billing and transactions in one simple platform—built specifically for the everyday needs of farmers, mandis, traders and FPOs.",
        icon: Boxes,
      },
      {
        name: "Transit Risk Insurance",
        description:
          "Delay, accident ya spoilage ke risk se perishable maal ko cover.",
        icon: ShieldCheck,
      },
    ],
  },
  {
    category: "Financial",
    products: [
      {
        name: "NBFC Credit",
        description: "Mandi auction ke cash flow ke hisaab se credit line.",
        icon: Landmark,
      },
      {
        name: "Working Capital",
        description: "Inventory kharido. Payment ka wait mat karo.",
        icon: WalletCards,
      },
    ],
  },
  {
    category: "Logistics & Tech",
    products: [
      {
        name: "Logistics Management",
        description: "Truck source karo. Shipment live track karo.",
        icon: Truck,
      },
      {
        name: "Prevention Harvesting Technology",
        description: "Crop loss prevent karo. Harvesting better plan karo.",
        icon: Wheat,
      },
      {
        name: "Marketplace",
        description: "Verified buyers aur sellers se seedha trade.",
        icon: Store,
      },
      {
        name: "Market Insights",
        description: "APMC prices aur supply signals, ek nazar mein.",
        icon: ChartNoAxesCombined,
      },
    ],
  },
] as const;

const ProductsPage = () => {
  return (
    <main className={styles.site}>
      <section className={styles.productPageHero}>
        <div className={styles.container}>
          <SiteChrome active="products" />

          <div className={styles.productHeroGrid}>
            <div className={styles.productHeroCopy}>
              <p className={styles.productEyebrow}>Our products</p>
              <h1 className={styles.productPageTitle}>
                Everything your <span>mandi trade needs.</span>
              </h1>
              <p className={styles.productPageLead}>
                Risk cover, finance, logistics and market access—
                <span>all in one place.</span>
              </p>
            </div>

            <div className={styles.productHeroVisual}>
              <Image
                src="/images/products/mandi-products-hero-v2.webp"
                alt="A mandi trader using his phone beside produce crates and a goods truck"
                fill
                priority
                sizes="(max-width: 800px) 100vw, 58vw"
                className={styles.productHeroImage}
              />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.productCatalog} aria-labelledby="products-heading">
        <div className={styles.container}>
          <header className={styles.productCatalogHeader}>
            <p className={styles.productEyebrow}>One connected mandi network</p>
            <h2 id="products-heading" className={styles.productCatalogTitle}>
              Explore our products
            </h2>
          </header>

          <div className={styles.productGroups}>
            {PRODUCT_GROUPS.map((group) => (
              <section key={group.category} className={styles.productGroup}>
                <h3 className={styles.productGroupTitle}>{group.category}</h3>

                <div className={styles.productListRows}>
                  {group.products.map((product) => {
                    const Icon = product.icon;

                    return (
                      <article key={product.name} className={styles.productItemRow}>
                        <span className={styles.productItemIcon} aria-hidden="true">
                          <Icon size={25} strokeWidth={1.65} />
                        </span>
                        <div>
                          <h4 className={styles.productItemName}>{product.name}</h4>
                          <p className={styles.productItemDescription}>
                            {product.description}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
};

export default ProductsPage;
