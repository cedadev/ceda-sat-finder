'''
Data Coverage Python Script:
----------------------------
Script to be used as a cron job to make sure that the data coverage maps are up to date.

    Author: Richard Smith
    Email:  richard.d.smith@stfc.ac.uk
    Date:   21st June 2017

    Updated to Python 3
    Author: Daniel Westwood
    Email:  daniel.westwood@stfc.ac.uk
    Date:   12th October 2022

In order to run the script. 
> python data_coverage.py <path_to_destination_folder>

In order to run this as a cron job in conjunction with Satellite Data Finder http://geo-search.ceda.ac.uk/:

1st command line argument should direct to the server path ./img/coverage_maps
'''

# Imports
import numpy as np
from math import floor, ceil
from elasticsearch import Elasticsearch
import sys
import os
import cartopy.crs as ccrs

# Setup matplotlib not to use x-based backend (for use on jasmin).
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

########################################### Function definitions #######################################################

def get_satellite_missions(es_index):
    '''
    Returns a list of the missions in the given index.
    
    :param es_index: the ElasticSearch index to be tested
    :return: A list of the missions in the given index
    '''

    agg_query = {
        "aggs": {
            "satellites": {
                "terms": {
                    "field": "misc.platform.Satellite.raw",
                    "size": 30
                }
            }
        },
        "size": 0
    }

    es = Elasticsearch(
        ["https://elasticsearch.ceda.ac.uk/:9243"], 
        )
        #hosts=[{"host": "jasmin-es1.ceda.ac.uk", "port": 9200}]
    #)

    res = es.search(index=es_index, body=agg_query)

    missions =  res['aggregations']['satellites']['buckets']
    mission_list = []
    for mission in missions:
        mission_list.append(mission['key'])

    return mission_list


def find_midpoint(coordinates):
    '''
    Accepts a list of lon, lat coordinate pairs and returns the average, removing any duplicates.
    Gives the centre point of the dataset for plotting on the map.
    
    :param coordinates: Input list of lon, lat coordinate pairs. eg [[lon, lat],[lon,lat]]
    :return: Midpoint for the given set of coordinates as a list [midx,midy] lon, lat.
    '''
    '''Remove duplicates and calculate average lat, lon'''

    x = set([float(x[0]) for x in coordinates]) #lon
    y = set([float(y[1]) for y in coordinates]) #lat

    midx = sum(x)/len(x)
    midy = sum(y)/len(y)

    return [midx,midy]

def extract_midpoints(page):
    '''
    Takes the results from an ES query and extracts the midpoints from the display coordinates of the satellite datasets.
    Returns a list of all the x coordinates, and list of all the y coordinates.
    
    :param page: An Elasticsearch page object 
    :return: A two lists of all the midpoints for the given ES query - x,y.
    '''
    x = []
    y = []

    hits = page['hits']['hits']

    for hit in hits:
        coords = hit['_source']['spatial']['geometries']['display']['coordinates'][0]
        mids = find_midpoint(coords)

        x.append(mids[0])
        y.append(mids[1])

    return x,y



def es_query(satellite,nw,se):
    '''
    
    :param satellite: The name of the satellite to be queried
    :param nw: The nw corner of the search area, [lon,lat]
    :param se: The se corner of the search area, [lon,lat]
    :return: JSON ES query.
    '''

    return {
        "_source": {
            "include": [
                "spatial.geometries.display"
            ]
        },
        "query": {
            "bool": {
                "must": {
                    "match_all": {}
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "geo_shape": {
                                    "spatial.geometries.search": {
                                        "shape": {
                                            "type": "envelope",
                                            "coordinates": [nw, se]
                                        }
                                    }
                                }

                            },
                            {"match":
                                {
                                    "misc.platform.Satellite.raw": satellite
                                }
                            },
                            {"exists": {
                                "field": "spatial.geometries.display.type"
                            }
                            }
                        ]
                    }
                }
            }
        }
    }

################################################### Main loop ##########################################################

if __name__ == "__main__":

    if len(sys.argv) == 1:
        # No file path provided
        print("Please provide a destination filepath for the plots")
        sys.exit()
    elif len(sys.argv) > 2:
        # Other arguments provided which will be ignored
        print("Any arguments after the first will be ignored")
        sys.exit()
    else:
        # An argument has been provided. Check that it is a valid directory.
        if not os.path.isdir(sys.argv[1]):
            print("The path provided is not a valid directory. Please enter the path to an exisiting directory")
            sys.exit()
        else:
            # Argument is a valid directory. Strip trailing slash if it exists.
            destination_folder = sys.argv[1].rstrip('/')

    nw = [-180,90]
    se = [180,-90]
    resolution = 4

    es = Elasticsearch(
        ["https://elasticsearch.ceda.ac.uk/:9243"], 
        )
            #hosts=[{"host": "jasmin-es1.ceda.ac.uk", "port": 9200, "scheme":""}],
        #)

    for mission in get_satellite_missions("ceda-eo-test"):

        print("\n")
        print("Searching for matching dataset: {}".format(mission))

        # Initialise the scroll
        page = es.search(
            index ="ceda-eo-test",
            scroll= '1m',
            size = 10000,
            body = es_query(mission,nw,se)
        )
        sid = page['_scroll_id']
        total_hits  = page['hits']['total']
        scroll_size = total_hits

        print("Total hits: {}".format(scroll_size))

        # Exit the script if no data is found.
        if total_hits == 0:
            print("No data found. Please check your satellite name.")
            sys.exit()


        # Set up the lists for the midpoints
        midpointsx = []
        midpointsy = []

        # Extract the midpoints from the first page.
        x,y = extract_midpoints(page)
        midpointsx += x
        midpointsy += y

        def percent_complete(total,progress):
            '''
            Gives a simple percentage based on end goal and current value.
            
            :param total: The total number of results for the ES query
            :param progress: The current number of results processed.
            :return: Returns a percentage complete
            '''
            return ceil(((float(progress)/total) * 100))


        # start scrolling
        progress = 0
        print("Scrolling...")
        while scroll_size > 0:
            page = es.scroll(scroll_id=sid, scroll='1m')
            # Update the scroll ID
            sid = page['_scroll_id']
            # Get the number of results that we returned in the last scroll
            scroll_size = len(page['hits']['hits'])
            progress += len(page['hits']['hits'])

            x, y = extract_midpoints(page)
            midpointsx += x
            midpointsy += y
            sys.stdout.write("Percentage complete: %d%% [%d/%d]\r" % (percent_complete(total_hits,progress),progress,total_hits ))
            sys.stdout.flush()

        sys.stdout.write(
            "Percentage complete: 100%% [%d/%d]\r" % (total_hits,total_hits))
        sys.stdout.flush()

        ################################################ PLOT THE GRAPH ################################################

        max_lon = int(ceil(se[0]))
        min_lon = int(floor(nw[0]))
        max_lat = int(ceil(nw[1]))
        min_lat = int(floor(se[1]))

        gridx = np.arange(min_lon, max_lon, resolution)
        gridy = np.arange(min_lat, max_lat, resolution)

        grid, _, _ = np.histogram2d(midpointsx, midpointsy, bins=[gridx, gridy])

        # Set values < 1 to white
        cmap = plt.cm.get_cmap('tab20c')
        cmap.set_under('w')

        fig = plt.figure()
        ax = plt.axes(projection=ccrs.PlateCarree())
        ax.coastlines()
        plt.pcolormesh(gridx, gridy, grid.T, cmap=cmap, vmin=1)
        plt.colorbar(label="Number of Datasets", orientation="horizontal")
        plt.title("%s Dataset Coverage: %s Degree Resolution" % (mission, resolution))
        fig.savefig('%s/%s.png' % (destination_folder, mission), dpi=fig.dpi)
        # print
    plt.show()
