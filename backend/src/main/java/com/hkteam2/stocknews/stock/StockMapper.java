package com.hkteam2.stocknews.stock;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;

/** stock_info 테이블 조회. SQL은 resources/mapper/stock/StockMapper.xml */
@Mapper
public interface StockMapper {

    List<StockResponse> findAll();
}
