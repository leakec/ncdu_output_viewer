import * as d3 from "d3";
import * as d3_colors from 'd3-scale-chromatic';

const color_schemes = Object.keys(d3_colors)
  .filter(key => key.startsWith('interpolate'))
  .map(key => key.replace('interpolate', ''));
  
class Chart {
    width = 1000;
    height = 750;
    data;
    hierarchy: d3.HierarchyNode<unknown>;
    root;
    svg: d3.Selection<SVGSVGElement, undefined, null, undefined>;
    color;
    focus;
    container;

    // For selecting the data type: dsize or asize
    // @ts-ignore
    data_type_select: HTMLSelectElement = document.createElement("Select");
    data_type = "dsize";
    data_type_h = "dsize_h";

    // For selecting the chart type
    // @ts-ignore
    chart_type_select: HTMLSelectElement = document.createElement("Select");
    chart_type = "icicle";

    // @ts-ignore
    num_layers_select: HTMLSelectElement = document.createElement("Select");
    num_layers = 3;

    // For selecting the chart color scheme
    // @ts-ignore
    color_scheme_select: HTMLSelectElement = document.createElement("Select");
    color_scheme = "Rainbow";

    // Current plot to draw
    plot: Icicle | Sunburst;

    constructor() {
        this.container = document.getElementById("container");
        // For selecting the chart type
        this.chart_type_select.add(new Option("icicle", "icicle", true, true));
        this.chart_type_select.add(new Option("sunburst", "sunburst"));
        this.chart_type_select.addEventListener("change", () => {
            this.chart_type = this.chart_type_select.value;
            this.svg.node()!.remove();
            if (this.chart_type == "icicle") {
                this.plot = new Icicle(this);
            } else {
                this.plot = new Sunburst(this);
            }
            this.focus = this.root
                .descendants()
                .find((d) => d.data.id === this.focus.data.id);
            this.plot.redraw();
            this.container.append(this.svg.node());
        });

        // For selecting the data type
        this.data_type_select.add(new Option("dsize", "dsize", true, true));
        this.data_type_select.add(new Option("asize", "asize"));
        this.data_type_select.addEventListener("change", () => {
            this.data_type = this.data_type_select.value;
            this.data_type_h = this.data_type + "_h";
            this.plot.redraw();
        });

        // For selecting the number of layers
        this.num_layers_select.add(new Option("2", "2"));
        this.num_layers_select.add(new Option("3", "3", true, true));
        this.num_layers_select.add(new Option("4", "4"));
        this.num_layers_select.add(new Option("5", "5"));
        this.num_layers_select.add(new Option("6", "6"));
        this.num_layers_select.addEventListener("change", () => {
            this.num_layers = parseInt(this.num_layers_select.value);
            this.modifyDataAtId(this.focus).then((_) => {
                this.plot.redraw();
            });
        });

        // For selecting the color scheme
        color_schemes.forEach((option) => {
            if (option == this.color_scheme) {
                this.color_scheme_select.add(new Option(option, option, true, true));
            } else {
                this.color_scheme_select.add(new Option(option, option));
            }
        });
        this.color_scheme_select.addEventListener("change", () => {
            this.color_scheme = this.color_scheme_select.value;
            this.plot.redraw();
        });

        this.container.append(this.color_scheme_select);
        this.container.append(this.chart_type_select);
        this.container.append(this.data_type_select);
        this.container.append(this.num_layers_select);
    }

    async init() {
        this.data = await this.getData(0, this.num_layers - 1);
        this.plot = new Icicle(this);
        this.container.append(this.svg.node());
    }

    async getData(nodeId, length) {
        return fetch(`http://localhost:3000/node/${nodeId}/${length}`)
            .then((x) => x.json())
            .then((data) => data["0"]["get_child_as_json"]);
    }

    computeHierarcy() {
        // Recompute the hierarchy and partition with the new data structure
        this.hierarchy = d3.hierarchy(this.data);

        // Use the pre-computed data_type as the nodes value.
        // @ts-ignore
        this.hierarchy.each((d) => (d.value = d.data![this.data_type]));

        // Compute colors based on the data
        this.color = d3.scaleOrdinal(
            d3.quantize(d3[`interpolate${this.color_scheme}`], this.data.children.length + 1),
        );
    }

    async modifyDataAtId(p) {
        return this.getData(p.data.id, this.num_layers - 1).then((new_data) => {
            // Append new data to the old data structure
            let dark = p;
            const p_ids = [];
            while (dark.data.id != 0) {
                // @ts-ignore
                p_ids.push(dark.data.id);
                dark = dark.parent;
            }

            let x = this.data;
            p_ids
                .slice(1)
                .reverse()
                .forEach((p_id) => {
                    let dark = x.child_ids.findIndex(
                        (element) => element == p_id,
                    );
                    x = x.children[dark];
                });

            let dark2 = x.child_ids.findIndex((element) => element == p_ids[0]);
            x.children[dark2] = new_data;
        });
    }
}

class Icicle {
    chart: Chart;
    cell;
    rect;
    text;
    tspan;
    old_focus_id;

    constructor(chart: Chart) {
        this.chart = chart;

        this.chart.svg = d3
            .create("svg")
            .attr("viewBox", [0, 0, this.chart.width, this.chart.height])
            .attr("width", this.chart.width)
            .attr("height", this.chart.height)
            .attr(
                "style",
                "max-width: 100%; height: auto; font: 10px sans-serif; position: absolute; top: 50px;",
            );

        this.draw();
    }

    // Helper function to set the rectangle height
    rectHeight(d) {
        return d.x1 - d.x0 - Math.min(1, (d.x1 - d.x0) / 2);
    }

    // Helper function to decide whether a label is visible or not
    labelVisible(d) {
        return d.y1 <= this.chart.width && d.y0 >= 0 && d.x1 - d.x0 > 16;
    }

    draw() {
        // Recompute hierarcy for data
        this.chart.computeHierarcy();

        this.chart.root = d3
            .partition()
            // @ts-ignore
            .size([
                this.chart.height,
                ((this.chart.hierarchy.height + 1) * this.chart.width) /
                    this.chart.num_layers,
            ])(this.chart.hierarchy);

        // Append cells.
        this.cell = this.chart.svg
            .selectAll("g")
            .data(this.chart.root.descendants())
            .join("g")
            // @ts-ignore
            .attr("transform", (d) => `translate(${d.y0},${d.x0})`);

        this.text = this.cell
            .append("text")
            .style("user-select", "none")
            .attr("pointer-events", "none")
            .attr("x", 4)
            .attr("y", 13)
            .attr("fill-opacity", (d) => +this.labelVisible(d));

        this.rect = this.cell
            .append("rect")
            .attr("width", (d) => d.y1 - d.y0 - 1)
            .attr("height", (d) => this.rectHeight(d))
            .attr("fill-opacity", (d) => (d.data.leaf ? 0.4 : 0.6))
            .attr("fill", (d) => {
                if (!d.depth) return "#ccc";
                while (d.depth > 1) d = d.parent;
                return this.chart.color(d.data.name);
            })
            .style("cursor", "pointer");

        this.text.append("tspan").text((d) => d.data.name);

        this.tspan = this.text
            .append("tspan")
            // @ts-ignore
            .attr("fill-opacity", (d) => this.labelVisible(d))
            .text((d) => " " + d.data[this.chart.data_type_h]);

        this.cell.append("title").text(
            (d) =>
                `${d
                    .ancestors()
                    .map((d) => d.data.name)
                    .reverse()
                    .join("/")}\n ${d.data[this.chart.data_type_h]}`,
        );

        if (this.chart.focus == null) {
            this.chart.focus = this.chart.root;
        }

        const clicked = (_, p) => {
            this.old_focus_id = this.chart.focus.data.id;
            if (this.chart.focus.data.id == p.data.id) {
                if (p.parent == null) {
                    // If the parent is null, we are at the root. Do nothing.
                    return;
                }

                // Going up the tree is easy. We don't need to get any new data. Just transition.
                p = p.parent;
                this.chart.focus = this.chart.focus === p ? (p = p.parent) : p;

                this.transition(p, 750);
            } else {
                // Early out if this is a leaf. Don't transition.
                if (p.data.leaf) {
                    return;
                }

                // Going down the tree is complicated. Get new data. Redraw the current graph and then transition.
                this.chart.focus = this.chart.focus === p ? (p = p.parent) : p;
                this.chart.modifyDataAtId(p).then((_) => {
                    // Redraw the chart at the old focus
                    let dark3 = this.chart.root
                        .descendants()
                        .find((d) => d.data.id === this.old_focus_id);
                    this.redraw(dark3).then(() => {
                        // Transition to the new spot
                        this.transition(p, 750);
                    });
                });
            }
        };

        this.rect.on("click", clicked);
    }

    async redraw(focus = null) {
        if (focus == null) {
            focus = this.chart.focus;
        }
        this.chart.svg.selectAll("g").remove();
        this.draw();
        return this.transition(focus, 0);
    }

    async transition(p, time) {
        // Target the new focus
        this.chart.root.each(
            (d) =>
                (d.target = {
                    x0: ((d.x0 - p.x0) / (p.x1 - p.x0)) * this.chart.height,
                    x1: ((d.x1 - p.x0) / (p.x1 - p.x0)) * this.chart.height,
                    y0: d.y0 - p.y0,
                    y1: d.y1 - p.y0,
                }),
        );

        const t = this.cell
            .transition()
            .duration(time)
            .attr(
                "transform",
                (d) => `translate(${d.target.y0},${d.target.x0})`,
            );

        // @ts-ignore
        let p1 = this.rect
            .transition(t)
            .attr("height", (d) => this.rectHeight(d.target))
            .end();
        // @ts-ignore
        let p2 = this.text
            .transition(t)
            .attr("fill-opacity", (d) => +this.labelVisible(d.target))
            .end();
        let p3 = this.tspan
            .transition(t)
            // @ts-ignore
            .attr("fill-opacity", (d) => this.labelVisible(d.target))
            .end();
        return Promise.all([p1, p2, p3]);
    }
}

class Sunburst {
    chart: Chart;
    cell;
    path;
    label;
    arc;
    center;
    radius = 0.0;

    constructor(chart) {
        this.chart = chart;

        this.chart.svg = d3
            .create("svg")
            .attr("viewBox", [
                -this.chart.width / 2,
                -this.chart.height / 2,
                this.chart.width,
                this.chart.width,
            ])
            .attr(
                "style",
                "max-width: 100%; height: auto; font: 10px sans-serif; position: absolute; top: 50px;",
            );

        this.draw();
    }

    draw() {
        // Compute the radius
        this.radius =
            Math.min(this.chart.width, this.chart.height) /
            (this.chart.num_layers * 2.3);

        // Recompute hierarcy for data
        this.chart.computeHierarcy();

        // TODO: Need to add num layers to this.
        this.chart.root = d3
            .partition()
            .size([2 * Math.PI, this.chart.hierarchy.height + 1])(
            this.chart.hierarchy,
        );

        // TODO: Do we need this?
        this.chart.root.each((d) => (d.current = d));

        if (this.chart.focus == null) {
            this.chart.focus = this.chart.root;
        }

        this.arc = d3
            .arc()
            // @ts-ignore
            .startAngle((d) => d.x0)
            // @ts-ignore
            .endAngle((d) => d.x1)
            // @ts-ignore
            .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(this.radius * 1.5)
            // @ts-ignore
            .innerRadius((d) => d.y0 * this.radius)
            .outerRadius((d) =>
                // @ts-ignore
                Math.max(d.y0 * this.radius, d.y1 * this.radius - 1),
            );

        this.path = this.chart.svg
            .append("g")
            .selectAll("path")
            .data(this.chart.root.descendants().slice(1))
            .join("path")
            .attr("fill", (d) => {
                // @ts-ignore
                while (d.depth > 1) d = d.parent;
                // @ts-ignore
                return this.chart.color(d.data.name);
            })
            .attr("fill-opacity", (d) =>
                // @ts-ignore
                this.arcVisible(d.current, this.chart.num_layers)
                    ? // @ts-ignore
                      d.data.leaf
                        ? 0.4
                        : 0.6
                    : 0,
            )
            .attr("pointer-events", (d) =>
                // @ts-ignore
                this.arcVisible(d.current, this.chart.num_layers)
                    ? "auto"
                    : "none",
            )
            // @ts-ignore
            .attr("d", (d) => this.arc(d.current))
            .style("cursor", "pointer");

        this.path.append("title").text(
            (d) =>
                `${d
                    .ancestors()
                    .map((d) => d.data.name)
                    .reverse()
                    .join("/")}\n ${d.data[this.chart.data_type_h]}`,
        );

        this.label = this.chart.svg
            .append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .classed("label-text", true)
            .style("user-select", "none")
            .selectAll("text")
            .data(this.chart.root.descendants().slice(1))
            .join("text")
            .attr("dy", "0.35em")
            .attr(
                "fill-opacity",
                // @ts-ignore
                (d) => +this.labelVisible(d.current, this.chart.num_layers),
            )
            .attr("transform", (d) =>
                // @ts-ignore
                this.labelTransform(d.current, this.radius),
            )
            // @ts-ignore
            .text((d) => d.data.name);

        this.center = this.chart.svg
            .append("circle")
            .datum(this.chart.focus)
            .attr("r", this.radius)
            .attr("fill", "none")
            .attr("pointer-events", "all");

        const clicked = (_, p) => {
            if (this.chart.focus.data.id == p.data.id) {
                if (p.parent == null) {
                    // If the parent is null, we are at the root. Do nothing.
                    return;
                }

                this.center.datum(p.parent || this.chart.root);
                this.chart.focus = this.chart.focus === p ? (p = p.parent) : p;

                this.transition(p, 750);
            } else {
                // Early out if this is a leaf. Don't transition.
                if (p.data.leaf) {
                    return;
                }

                // Going down the tree is complicated. Get new data. Redraw the current graph and then transition.
                this.chart
                    .getData(p.data.id, this.chart.num_layers - 1)
                    .then((new_data) => {
                        if (
                            new_data.children != null &&
                            new_data.children.length != 0
                        ) {
                            this.center.datum(p.parent || this.chart.root);
                            const old_focus_id = this.chart.focus.data.id;
                            this.chart.focus =
                                this.chart.focus === p ? (p = p.parent) : p;

                            // Append new data to the old data structure
                            let dark = p;
                            const p_ids = [];
                            while (dark.data.id != 0) {
                                // @ts-ignore
                                p_ids.push(dark.data.id);
                                dark = dark.parent;
                            }

                            let x = this.chart.data;
                            p_ids
                                .slice(1)
                                .reverse()
                                .forEach((p_id) => {
                                    let dark = x.child_ids.findIndex(
                                        (element) => element == p_id,
                                    );
                                    x = x.children[dark];
                                });

                            let dark2 = x.child_ids.findIndex(
                                (element) => element == p_ids[0],
                            );
                            x.children[dark2] = new_data;

                            // Redraw the chart at the old focus
                            let dark3 = this.chart.root
                                .descendants()
                                .find((d) => d.data.id === old_focus_id);
                            this.redraw(dark3).then(() => {
                                this.transition(p, 750);
                            });
                        }
                    });
            }
        };

        this.center.on("click", clicked);
        this.path.on("click", clicked);
    }

    async redraw(focus = null) {
        if (focus == null) {
            focus = this.chart.focus;
        }
        this.chart.svg.selectAll("g").remove();
        this.draw();
        return this.transition(focus, 0);
    }

    async transition(p, time) {
        this.chart.root.each(
            (d) =>
                (d.target = {
                    x0:
                        Math.max(
                            0,
                            Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0)),
                        ) *
                        2 *
                        Math.PI,
                    x1:
                        Math.max(
                            0,
                            Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0)),
                        ) *
                        2 *
                        Math.PI,
                    y0: Math.max(0, d.y0 - p.depth),
                    y1: Math.max(0, d.y1 - p.depth),
                }),
        );

        const t = this.chart.svg.transition().duration(time);
        const arcVisible = (d) => this.arcVisible(d, this.chart.num_layers);
        const labelVisible = (d) => this.labelVisible(d, this.chart.num_layers);
        const labelTransform = (d) => this.labelTransform(d, this.radius);

        // Transition the data on all arcs, even the ones that aren’t visible,
        // so that if this transition is interrupted, entering arcs will start
        // the next transition from the desired position.
        let p1 = this.path
            .transition(t)
            .tween("data", (d) => {
                const i = d3.interpolate(d.current, d.target);
                return (t) => (d.current = i(t));
            })
            .filter(function (d) {
                return (
                    +this.getAttribute("fill-opacity") || arcVisible(d.target)
                );
            })
            .attr("fill-opacity", (d) =>
                // @ts-ignore
                arcVisible(d.target) ? (d.data.leaf ? 0.4 : 0.6) : 0,
            )
            .attr("pointer-events", (d) =>
                arcVisible(d.target) ? "auto" : "none",
            )

            .attrTween("d", (d) => () => this.arc(d.current))
            .end();

        let p2 = this.label
            .filter(function (d) {
                return (
                    +this.getAttribute("fill-opacity") || labelVisible(d.target)
                );
            })
            .transition(t)
            .attr("fill-opacity", (d) => +labelVisible(d.target))
            .attrTween("transform", (d) => () => labelTransform(d.current))
            .end();

        return Promise.all([p1, p2]);
    }

    arcVisible(d, num_layers) {
        return d.y1 <= num_layers && d.y0 >= 1 && d.x1 > d.x0;
    }

    labelVisible(d, num_layers) {
        return (
            d.y1 <= num_layers &&
            d.y0 >= 1 &&
            (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03
        );
    }

    labelTransform(d, radius) {
        const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
        const y = ((d.y0 + d.y1) / 2) * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
}

let chart = new Chart();
chart.init();
