import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';

const RadialTreeView = ({ data, onPersonClick }) => {
  const svgRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    const radius = Math.min(width, height) / 2 - 50;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Build hierarchy
    const nodeMap = new Map(data.nodes.map((node) => [node.id, node]));
    const childrenMap = new Map();
    const hasParent = new Set();

    data.edges.forEach((edge) => {
      if (edge.type === 'parent') {
        hasParent.add(edge.target);
        if (!childrenMap.has(edge.source)) {
          childrenMap.set(edge.source, []);
        }
        childrenMap.get(edge.source).push(edge.target);
      }
    });

    const rootNodes = data.nodes.filter((node) => !hasParent.has(node.id.toString()));

    const buildTree = (nodeId) => {
      const node = nodeMap.get(parseInt(nodeId));
      if (!node) return null;

      const children = childrenMap.get(nodeId) || [];
      return {
        ...node.data,
        id: node.id,
        children: children.map((childId) => buildTree(childId)).filter(Boolean),
      };
    };

    const rootData = rootNodes.length > 0
      ? buildTree(rootNodes[0].id)
      : { id: data.nodes[0].id, ...data.nodes[0].data, children: [] };

    const root = d3.hierarchy(rootData);

    const treeLayout = d3.tree().size([2 * Math.PI, radius]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    treeLayout(root);

    // Draw links
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkRadial().angle((d) => d.x).radius((d) => d.y))
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 2);

    // Draw nodes
    const nodes = g
      .selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`)
      .style('cursor', onPersonClick ? 'pointer' : 'default')
      .on('click', (event, d) => {
        if (onPersonClick && d.data.id) {
          onPersonClick(d.data.id);
        }
      });

    nodes
      .append('circle')
      .attr('r', 20)
      .attr('fill', '#1976d2')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    nodes
      .append('text')
      .attr('dy', 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('transform', (d) => `rotate(${90 - (d.x * 180) / Math.PI})`)
      .text((d) => d.data.full_name || d.data.label || 'Unknown');
  }, [data, onPersonClick]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <svg ref={svgRef} style={{ display: 'block' }}></svg>
    </Box>
  );
};

export default RadialTreeView;

