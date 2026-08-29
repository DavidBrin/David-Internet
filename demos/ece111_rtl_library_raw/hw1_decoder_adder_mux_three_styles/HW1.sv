module HW1 (
    input logic a, b, sel,
    output logic out_g, out_d, out_b
);

    // Instantiate your three different versions to see them all compile
    mux_2x1g gate_version (.a(a), .b(b), .sel(sel), .out(out_g));
    mux_2x1d data_version (.a(a), .b(b), .sel(sel), .out(out_d));
    mux_2x1b behv_version (.a(a), .b(b), .sel(sel), .out(out_b));

endmodule