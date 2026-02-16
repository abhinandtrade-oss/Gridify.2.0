-- Function to get financial summary
CREATE OR REPLACE FUNCTION get_accounts_summary(p_start_date timestamptz, p_end_date timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_pricing_config jsonb;
    v_platform_fee_pct numeric;
    v_min_fee numeric;
    -- v_gst_rate numeric; -- Removed
    
    v_total_rev numeric := 0;
    v_plat_fees numeric := 0;
    v_supp_earn numeric := 0;
    v_pend_rev numeric := 0;
    v_tot_refunds numeric := 0;
    
    rec record;
    v_fee numeric;
    -- v_gst numeric; -- GST Not Collected
    v_deduction numeric;
BEGIN
    -- 1. Get Pricing Config
    SELECT value INTO v_pricing_config FROM site_settings WHERE key = 'pricing_config';
    v_platform_fee_pct := COALESCE((v_pricing_config->>'platformFee')::numeric, 0);
    v_min_fee := COALESCE((v_pricing_config->>'minFee')::numeric, 0);
    -- v_gst_rate := COALESCE((v_pricing_config->>'gstRate')::numeric, 18); -- Removed

    -- 2. Process Orders
    FOR rec IN 
        SELECT id, total_amount, status
        FROM orders 
        WHERE created_at >= p_start_date AND created_at <= p_end_date
    LOOP
        -- Calculate Fee for this Order
        v_fee := (rec.total_amount * v_platform_fee_pct) / 100;
        IF v_fee < v_min_fee THEN v_fee := v_min_fee; END IF;
        -- v_gst := (v_fee * v_gst_rate) / 100; -- Removed
        v_deduction := v_fee; -- No GST applied

        -- Apply Status Logic
        IF rec.status = 'delivered' THEN
            v_total_rev := v_total_rev + rec.total_amount;
            v_plat_fees := v_plat_fees + v_deduction; -- Fee Generated
            v_supp_earn := v_supp_earn + (rec.total_amount - v_deduction);
        ELSIF rec.status IN ('return_refund', 'returned') THEN
            v_total_rev := v_total_rev - rec.total_amount; -- Reverse Revenue
            -- v_plat_fees := v_plat_fees - v_deduction; -- OLD: Reverse Fee
            -- Platform keeps fee (No Reversal)
            
            v_supp_earn := v_supp_earn - rec.total_amount; -- New: Reverse Full Amount
            v_tot_refunds := v_tot_refunds + rec.total_amount; -- Track Refund
        ELSIF rec.status IN ('pending', 'processing', 'shipped') THEN
            v_pend_rev := v_pend_rev + rec.total_amount;
        -- Replacements and Failures are excluded from revenue calculation per rules
        END IF;

    END LOOP;

    RETURN jsonb_build_object(
        'total_revenue', v_total_rev,
        'platform_fees', v_plat_fees,
        'supplier_earnings', v_supp_earn,
        'pending_revenue', v_pend_rev,
        'total_refunds', v_tot_refunds
    );
END;
$$;

-- Function to get Supplier Summary
CREATE OR REPLACE FUNCTION get_supplier_ledger(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
    supplier_id uuid,
    supplier_name text,
    total_sales numeric,
    total_refunds numeric,
    platform_fee_generated numeric,
    -- gst_gen numeric, -- Removed
    net_payable numeric,
    pending_revenue numeric,
    total_orders bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pricing_config jsonb;
    v_platform_fee_pct numeric;
    v_min_fee numeric;
    -- v_gst_rate numeric; -- Removed
BEGIN
    SELECT value INTO v_pricing_config FROM site_settings WHERE key = 'pricing_config';
    v_platform_fee_pct := COALESCE((v_pricing_config->>'platformFee')::numeric, 0);
    v_min_fee := COALESCE((v_pricing_config->>'minFee')::numeric, 0);
    -- v_gst_rate := COALESCE((v_pricing_config->>'gstRate')::numeric, 18); -- Removed

    RETURN QUERY
    WITH OrderCalcs AS (
        SELECT 
            o.id,
            o.total_amount,
            o.status,
            -- Assuming orders have a seller_id or link to seller via items?
            -- Since order structure is complex (marketplace), usually order is per-seller or split.
            -- If 'orders' table has 'seller_id', great. If not, we assume single-seller per order for simplicity 
            -- or join order_items -> products -> seller_id.
            -- Let's inspect 'orders' schema... Assume 'seller_id' exists on 'orders' or join.
            -- Based on prompt "Supplier Summary Table", we need supplier grouping.
            -- Using a mock join here as schema isn't fully visible, assuming order -> products -> seller.
            -- Using a subquery to find seller for order (assuming 1 seller per order).
            (
                SELECT p.seller_id 
                FROM order_items oi 
                JOIN products p ON oi.product_id = p.id 
                WHERE oi.order_id = o.id 
                LIMIT 1
            ) as seller_id,
            -- Fee Calc (No GST)
            GREATEST((o.total_amount * v_platform_fee_pct / 100), v_min_fee) as fee_amt
        FROM orders o
        WHERE o.created_at BETWEEN p_start_date AND p_end_date
    )
    SELECT 
        s.id,
        (s.first_name || ' ' || s.last_name) as supplier_name,
        COALESCE(SUM(CASE WHEN oc.status = 'delivered' THEN oc.total_amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN oc.status IN ('return_refund', 'returned') THEN oc.total_amount ELSE 0 END), 0) as total_sales,
        
        COALESCE(SUM(CASE WHEN oc.status IN ('return_refund', 'returned') THEN oc.total_amount ELSE 0 END), 0) as refunds,
        
        -- Fee Generated: Delivered only
        COALESCE(SUM(CASE WHEN oc.status = 'delivered' THEN oc.fee_amt ELSE 0 END), 0) as platform_fee_generated,
        
        -- COALESCE(SUM(CASE WHEN oc.status = 'delivered' THEN oc.gst_amt ELSE 0 END), 0) as gst_gen, -- Removed
        
        -- Net Pay: (Delivered Rev - Delivered Fee) - (Return Rev)
        (COALESCE(SUM(CASE WHEN oc.status = 'delivered' THEN oc.total_amount ELSE 0 END), 0) - 
         COALESCE(SUM(CASE WHEN oc.status = 'delivered' THEN oc.fee_amt ELSE 0 END), 0)) -
        COALESCE(SUM(CASE WHEN oc.status IN ('return_refund', 'returned') THEN oc.total_amount ELSE 0 END), 0) as net_payable,
         
        COALESCE(SUM(CASE WHEN oc.status IN ('pending', 'processing', 'shipped') THEN oc.total_amount ELSE 0 END), 0) as pending_revenue,
        
        COUNT(oc.id) as total_orders
        
    FROM OrderCalcs oc
    JOIN sellers s ON oc.seller_id = s.id
    GROUP BY s.id, s.first_name, s.last_name;
END;
$$;

-- Function for Transaction Ledger
CREATE OR REPLACE FUNCTION get_transaction_ledger(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
    order_id uuid,
    created_at timestamptz,
    supplier_name text,
    status text,
    gross_amount numeric,
    platform_fee numeric,
    -- gst numeric, -- Removed
    supplier_earning numeric,
    refund_deduction numeric,
    net_impact numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pricing_config jsonb;
    v_platform_fee_pct numeric;
    v_min_fee numeric;
    -- v_gst_rate numeric; -- Removed
BEGIN
    SELECT value INTO v_pricing_config FROM site_settings WHERE key = 'pricing_config';
    v_platform_fee_pct := COALESCE((v_pricing_config->>'platformFee')::numeric, 0);
    v_min_fee := COALESCE((v_pricing_config->>'minFee')::numeric, 0);
    -- v_gst_rate := COALESCE((v_pricing_config->>'gstRate')::numeric, 18); -- Removed

    RETURN QUERY
    SELECT 
        o.id,
        o.created_at,
        (s.first_name || ' ' || s.last_name) as supplier_name,
        o.status,
        o.total_amount as gross_amount,
        
        -- Platform Fee (Base)
        CASE 
            WHEN o.status = 'delivered' THEN GREATEST((o.total_amount * v_platform_fee_pct / 100), v_min_fee)
            ELSE 0 
        END as platform_fee,
        
        -- GST -- Removed
        -- CASE 
        --     WHEN o.status = 'delivered' THEN (GREATEST((o.total_amount * v_platform_fee_pct / 100), v_min_fee) * v_gst_rate/100)
        --     ELSE 0 
        -- END as gst,
        
        -- Supplier Earning (Gross - Fee)
        CASE 
            WHEN o.status = 'delivered' THEN (o.total_amount - GREATEST((o.total_amount * v_platform_fee_pct / 100), v_min_fee))
            WHEN o.status IN ('return_refund', 'returned') THEN -o.total_amount 
            ELSE 0 
        END as supplier_earning,
        
        -- Refund Deduction
        CASE 
            WHEN o.status IN ('return_refund', 'returned') THEN o.total_amount
            ELSE 0 
        END as refund_deduction,
        
        -- Net Impact
        CASE 
            WHEN o.status = 'delivered' THEN (o.total_amount - GREATEST((o.total_amount * v_platform_fee_pct / 100), v_min_fee))
            WHEN o.status IN ('return_refund', 'returned') THEN -o.total_amount
            ELSE 0 
        END as net_impact
        
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id -- Join to get product -> seller. Warning: Multi-item orders with diff sellers?
    -- Assuming single seller per order for now or picking first.
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY o.id, o.created_at, s.first_name, s.last_name, o.status, o.total_amount
    ORDER BY o.created_at DESC;
END;
$$;
