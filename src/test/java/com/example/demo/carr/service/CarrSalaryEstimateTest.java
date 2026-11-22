package com.example.demo.carr.service;
import com.example.demo.carr.dto.CarrDtos.SalaryBenchmarkRequest;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CarrSalaryEstimateTest {
 @Test void doesNotClaimVerifiedThirdPartyOrLiveMarketData(){
  var request=new SalaryBenchmarkRequest("Developer",null,null,2,5,"Dubai","AED","MONTHLY",null,null);
  var result=new CarrSalaryBenchmarkService().calculateBenchmark(request);
  assertTrue(result.dataSource().contains("not verified market data"));assertFalse(result.dataSource().contains("Mercer"));assertFalse(result.dataSource().contains("Hays"));assertFalse(result.marketTrend().contains("4.6"));
 }
}
