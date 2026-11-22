package com.example.demo.carr.service;

import com.example.demo.carr.dto.CarrDtos.SalaryBenchmarkRequest;
import com.example.demo.carr.dto.CarrDtos.SalaryBenchmarkResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Illustrative salary-planning estimates from internal, static assumptions.
 * Not a market survey, verified third-party dataset, or live compensation feed.
 */
@Service
public class CarrSalaryBenchmarkService {

    // Base Monthly AED salary benchmarks for Mid-Level (3-5 years) by role title pattern
    private record RoleBase(List<String> keywords, double p25, double p50, double p75, double p90, String department) {}

    private static final List<RoleBase> BENCHMARKS = List.of(
        // Sales & BD
        new RoleBase(List.of("sales director", "head of sales", "vp of sales", "vp sales"), 40000, 52000, 68000, 85000, "Sales"),
        new RoleBase(List.of("sales manager", "commercial manager"), 18000, 25000, 34000, 42000, "Sales"),
        new RoleBase(List.of("business development manager", "bd manager"), 19000, 26000, 35000, 44000, "Sales"),
        new RoleBase(List.of("account manager", "key account manager", "client relationship manager"), 12000, 17000, 23000, 30000, "Sales"),
        new RoleBase(List.of("sales executive", "inside sales", "sales specialist", "sales representative"), 9000, 13000, 18000, 24000, "Sales"),
        new RoleBase(List.of("business development executive", "bde", "sdr"), 9000, 13500, 18500, 24000, "Sales"),

        // Engineering & IT
        new RoleBase(List.of("chief technology officer", "cto", "vp of engineering", "vp engineering", "head of engineering"), 45000, 60000, 80000, 100000, "Engineering"),
        new RoleBase(List.of("engineering manager", "technical lead", "tech lead"), 28000, 38000, 48000, 60000, "Engineering"),
        new RoleBase(List.of("principal engineer", "software architect", "solutions architect"), 26000, 35000, 46000, 58000, "Engineering"),
        new RoleBase(List.of("senior developer", "senior software engineer", "senior full stack", "senior backend", "senior frontend"), 20000, 28000, 37000, 46000, "Engineering"),
        new RoleBase(List.of("developer", "software engineer", "full stack", "backend developer", "frontend developer", "programmer"), 12000, 17500, 24000, 30000, "Engineering"),
        new RoleBase(List.of("devops engineer", "cloud engineer", "site reliability engineer", "sre", "infrastructure engineer"), 16000, 23000, 32000, 40000, "Engineering"),
        new RoleBase(List.of("qa engineer", "quality assurance engineer", "test automation", "qa automation"), 10000, 14500, 19500, 25000, "Engineering"),
        new RoleBase(List.of("data scientist", "machine learning engineer", "ai engineer"), 18000, 26000, 36000, 48000, "Engineering"),
        new RoleBase(List.of("data engineer", "bi developer", "data analyst"), 13000, 18500, 25000, 32000, "Engineering"),
        new RoleBase(List.of("it support engineer", "helpdesk", "system administrator", "desktop support"), 6500, 9500, 13500, 18000, "IT & Operations"),

        // Product & Project Management
        new RoleBase(List.of("vp of product", "head of product", "chief product officer", "cpo"), 42000, 56000, 75000, 92000, "Product"),
        new RoleBase(List.of("product manager", "senior product manager"), 20000, 28000, 38000, 48000, "Product"),
        new RoleBase(List.of("associate product manager", "product owner"), 14000, 20000, 27000, 34000, "Product"),
        new RoleBase(List.of("project manager", "pmo lead"), 17000, 24000, 33000, 42000, "Project Management"),
        new RoleBase(List.of("scrum master", "agile coach"), 16000, 22000, 30000, 38000, "Project Management"),
        new RoleBase(List.of("business analyst", "systems analyst"), 12000, 17000, 23000, 30000, "Product"),

        // Human Resources & People
        new RoleBase(List.of("chief people officer", "cpo", "vp of hr", "hr director", "head of hr"), 38000, 50000, 68000, 85000, "Human Resources"),
        new RoleBase(List.of("hr manager", "human resources manager", "people operations manager"), 18000, 25000, 34000, 42000, "Human Resources"),
        new RoleBase(List.of("talent acquisition manager", "recruitment manager"), 17000, 23000, 31000, 38000, "Human Resources"),
        new RoleBase(List.of("recruiter", "talent acquisition specialist", "talent sourcer"), 9500, 13500, 18500, 24000, "Human Resources"),
        new RoleBase(List.of("hr business partner", "hrbp"), 15000, 21000, 28000, 36000, "Human Resources"),
        new RoleBase(List.of("hr executive", "hr officer", "hr generalist", "hr coordinator"), 7500, 10500, 14500, 19000, "Human Resources"),

        // Finance & Accounting
        new RoleBase(List.of("chief financial officer", "cfo", "vp finance", "finance director"), 45000, 62000, 85000, 110000, "Finance"),
        new RoleBase(List.of("finance manager", "financial controller"), 22000, 30000, 41000, 52000, "Finance"),
        new RoleBase(List.of("financial analyst", "fp&a analyst"), 12000, 17500, 24000, 31000, "Finance"),
        new RoleBase(List.of("senior accountant", "chief accountant"), 14000, 19000, 25000, 32000, "Finance"),
        new RoleBase(List.of("accountant", "staff accountant"), 8000, 11500, 16000, 21000, "Finance"),
        new RoleBase(List.of("payroll specialist", "payroll manager", "payroll officer"), 9000, 13000, 18000, 24000, "Finance"),
        new RoleBase(List.of("accounts executive", "accounts payable", "accounts receivable"), 6500, 9000, 12500, 16500, "Finance"),

        // Marketing & Creative
        new RoleBase(List.of("chief marketing officer", "cmo", "vp marketing", "marketing director"), 40000, 55000, 72000, 90000, "Marketing"),
        new RoleBase(List.of("marketing manager", "brand manager", "growth manager"), 18000, 25000, 33000, 42000, "Marketing"),
        new RoleBase(List.of("digital marketing manager", "performance marketing manager"), 17000, 24000, 32000, 40000, "Marketing"),
        new RoleBase(List.of("digital marketing executive", "performance marketer"), 8500, 12000, 16500, 22000, "Marketing"),
        new RoleBase(List.of("ui/ux designer", "product designer", "ux designer"), 14000, 20000, 27000, 35000, "Design"),
        new RoleBase(List.of("graphic designer", "visual designer"), 7500, 11000, 15000, 20000, "Design"),
        new RoleBase(List.of("content writer", "copywriter", "content creator"), 7500, 10500, 14500, 19000, "Marketing"),
        new RoleBase(List.of("seo specialist", "seo manager"), 9000, 13500, 18500, 24000, "Marketing"),

        // Operations & Administration
        new RoleBase(List.of("chief operating officer", "coo", "vp operations"), 45000, 62000, 82000, 105000, "Operations"),
        new RoleBase(List.of("operations manager", "general manager"), 19000, 26000, 35000, 45000, "Operations"),
        new RoleBase(List.of("operations executive", "operations coordinator"), 7500, 10500, 14500, 19000, "Operations"),
        new RoleBase(List.of("administration manager", "office manager"), 12000, 17000, 23000, 29000, "Administration"),
        new RoleBase(List.of("admin executive", "administrative assistant", "executive assistant"), 6000, 8500, 12000, 16000, "Administration"),
        new RoleBase(List.of("customer support manager", "customer service manager", "customer success lead"), 15000, 21000, 28000, 36000, "Customer Success"),
        new RoleBase(List.of("customer support executive", "customer service representative"), 5500, 8000, 11500, 15000, "Customer Success"),
        new RoleBase(List.of("procurement manager", "supply chain manager"), 18000, 25000, 34000, 43000, "Procurement & Logistics"),
        new RoleBase(List.of("logistics coordinator", "procurement officer"), 7500, 11000, 15000, 20000, "Procurement & Logistics")
    );

    public SalaryBenchmarkResponse calculateBenchmark(SalaryBenchmarkRequest req) {
        String title = req.title() != null ? req.title().trim() : "General Professional";
        String normalizedTitle = title.toLowerCase(Locale.ROOT);

        // 1. Find matching base role benchmark
        RoleBase matched = BENCHMARKS.stream()
            .filter(rb -> rb.keywords().stream().anyMatch(kw -> normalizedTitle.contains(kw) || kw.contains(normalizedTitle)))
            .findFirst()
            .orElseGet(() -> estimateGenericRole(normalizedTitle, req.departmentName()));

        // 2. Experience & Seniority Factor
        int minExp = req.experienceMinYears() != null ? Math.max(0, req.experienceMinYears()) : 3;
        int maxExp = req.experienceMaxYears() != null ? Math.max(minExp, req.experienceMaxYears()) : minExp + 3;
        double avgExp = (minExp + maxExp) / 2.0;

        double expFactor;
        String seniorityLabel;
        if (avgExp <= 1.5) {
            expFactor = 0.78;
            seniorityLabel = "Entry-Level (0-2 yrs)";
        } else if (avgExp <= 4.5) {
            expFactor = 1.00;
            seniorityLabel = "Mid-Level (3-5 yrs)";
        } else if (avgExp <= 7.5) {
            expFactor = 1.28;
            seniorityLabel = "Senior (6-8 yrs)";
        } else if (avgExp <= 11.5) {
            expFactor = 1.55;
            seniorityLabel = "Lead / Manager (8-11 yrs)";
        } else {
            expFactor = 1.90;
            seniorityLabel = "Executive / Director (12+ yrs)";
        }

        // 3. Location Factor
        String loc = req.location() != null ? req.location().toLowerCase(Locale.ROOT) : "dubai";
        double locFactor = 1.00;
        if (loc.contains("saudi") || loc.contains("riyadh") || loc.contains("jeddah")) {
            locFactor = 1.08;
        } else if (loc.contains("qatar") || loc.contains("doha")) {
            locFactor = 1.02;
        } else if (loc.contains("uk") || loc.contains("london")) {
            locFactor = 1.15;
        } else if (loc.contains("us") || loc.contains("united states") || loc.contains("new york") || loc.contains("san francisco")) {
            locFactor = 1.35;
        } else if (loc.contains("india") || loc.contains("bangalore") || loc.contains("mumbai")) {
            locFactor = 0.45;
        }

        // 4. Base AED Monthly Percentiles
        double p25Aed = matched.p25() * expFactor * locFactor;
        double p50Aed = matched.p50() * expFactor * locFactor;
        double p75Aed = matched.p75() * expFactor * locFactor;
        double p90Aed = matched.p90() * expFactor * locFactor;

        // 5. Currency Conversion
        String currency = req.currency() != null && !req.currency().isBlank() ? req.currency().toUpperCase(Locale.ROOT) : "AED";
        double currencyRate = switch (currency) {
            case "USD" -> 1.0 / 3.6725;
            case "EUR" -> 1.0 / 3.98;
            case "GBP" -> 1.0 / 4.75;
            case "SAR" -> 1.0 / 0.98;
            case "INR" -> 22.85;
            case "QAR" -> 0.99;
            default -> 1.00; // AED
        };

        // 6. Frequency Conversion
        String frequency = req.frequency() != null && !req.frequency().isBlank() ? req.frequency().toUpperCase(Locale.ROOT) : "MONTHLY";
        double freqMultiplier = frequency.contains("ANNUAL") || frequency.contains("YEAR") ? 12.0 : 1.0;

        BigDecimal p25 = round(p25Aed * currencyRate * freqMultiplier);
        BigDecimal p50 = round(p50Aed * currencyRate * freqMultiplier);
        BigDecimal p75 = round(p75Aed * currencyRate * freqMultiplier);
        BigDecimal p90 = round(p90Aed * currencyRate * freqMultiplier);

        // 7. Competitiveness Evaluation
        String competitiveness = "MARKET_STANDARD";
        String competitivenessLabel = "Illustrative midpoint reference—not verified market positioning";
        if (req.currentSalaryMin() != null || req.currentSalaryMax() != null) {
            BigDecimal maxSal = req.currentSalaryMax() != null ? req.currentSalaryMax() : req.currentSalaryMin();
            BigDecimal minSal = req.currentSalaryMin() != null ? req.currentSalaryMin() : req.currentSalaryMax();

            if (maxSal.compareTo(p25) < 0) {
                competitiveness = "BELOW_MARKET";
                competitivenessLabel = "Below the illustrative reference range";
            } else if (minSal.compareTo(p75) > 0) {
                competitiveness = "PREMIUM";
                competitivenessLabel = "Above the illustrative upper range";
            } else if (minSal.compareTo(p50) > 0) {
                competitiveness = "HIGHLY_COMPETITIVE";
                competitivenessLabel = "Within the illustrative reference range";
            } else {
                competitiveness = "MARKET_STANDARD";
                competitivenessLabel = "Within the illustrative reference range";
            }
        }

        String recommendedRange = String.format("%s %,d - %,d / %s",
            currency, p25.longValue(), p75.longValue(), frequency.toLowerCase(Locale.ROOT));

        String marketTrend = "No live market trend data is available";
        String dataSource = "Illustrative estimate from Grecha's internal static assumptions; not verified market data. Validate independently before making compensation decisions.";

        return new SalaryBenchmarkResponse(
            title,
            req.location() != null ? req.location() : "Dubai, UAE",
            currency,
            frequency,
            seniorityLabel,
            p25,
            p50,
            p75,
            p90,
            competitiveness,
            competitivenessLabel,
            marketTrend,
            recommendedRange,
            dataSource
        );
    }

    private RoleBase estimateGenericRole(String normalizedTitle, String department) {
        if (normalizedTitle.contains("director") || normalizedTitle.contains("head") || normalizedTitle.contains("chief") || normalizedTitle.contains("vp")) {
            return new RoleBase(List.of("director"), 38000, 52000, 70000, 88000, department != null ? department : "Executive");
        }
        if (normalizedTitle.contains("manager") || normalizedTitle.contains("lead")) {
            return new RoleBase(List.of("manager"), 18000, 25000, 34000, 42000, department != null ? department : "Management");
        }
        if (normalizedTitle.contains("senior") || normalizedTitle.contains("specialist") || normalizedTitle.contains("consultant")) {
            return new RoleBase(List.of("senior"), 15000, 21000, 28000, 36000, department != null ? department : "Professional");
        }
        if (normalizedTitle.contains("coordinator") || normalizedTitle.contains("assistant") || normalizedTitle.contains("associate") || normalizedTitle.contains("junior")) {
            return new RoleBase(List.of("junior"), 6500, 9000, 12500, 16500, department != null ? department : "Support");
        }
        // Default professional role
        return new RoleBase(List.of("professional"), 11000, 16000, 22000, 28000, department != null ? department : "General");
    }

    private BigDecimal round(double val) {
        // Round to nearest 500 for clean compensation figures
        long rounded = Math.round(val / 500.0) * 500;
        if (rounded <= 0) rounded = Math.round(val);
        return BigDecimal.valueOf(rounded).setScale(2, RoundingMode.HALF_UP);
    }
}
